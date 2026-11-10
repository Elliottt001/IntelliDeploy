"""Small allowlisted dependency/capability proxy for internal job networks."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import http.client
import ipaddress
import os
import select
import socket
from urllib.parse import urlsplit


def destination(host, port, allowed, private_allowed):
    if host not in allowed or port not in {
        80,
        443,
        *[int(p) for p in os.environ.get("ALLOWED_PRIVATE_PORTS", "").split(",") if p],
    }:
        raise ValueError("destination is not registered")
    addresses = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    for address in addresses:
        value = ipaddress.ip_address(address[4][0])
        if value.is_link_local or value.is_unspecified or value.is_multicast:
            continue
        if value.is_global or host in private_allowed:
            return address[4][0]
    raise ValueError("destination address is not permitted")


class Proxy(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def target(self, host, port):
        return destination(
            host,
            port,
            set(os.environ.get("ALLOWED_HOSTS", "").split(",")),
            set(os.environ.get("ALLOWED_PRIVATE_HOSTS", "").split(",")),
        )

    def do_CONNECT(self):
        try:
            url = urlsplit("http://" + self.path)
            if url.username or url.password or not url.hostname:
                raise ValueError()
            port = url.port or 443
            ip = self.target(url.hostname, port)
            with socket.create_connection((ip, port), timeout=10) as upstream:
                self.send_response(200)
                self.end_headers()
                self.connection.settimeout(30)
                upstream.settimeout(30)
                while True:
                    ready, _, _ = select.select([self.connection, upstream], [], [], 30)
                    if not ready:
                        return
                    for source in ready:
                        data = source.recv(65536)
                        if not data:
                            return
                        (
                            upstream if source is self.connection else self.connection
                        ).sendall(data)
        except (OSError, ValueError):
            self.close_connection = True

    def do_GET(self):
        try:
            url = urlsplit(self.path)
            if url.scheme != "http" or not url.hostname or url.username or url.password:
                raise ValueError()
            port = url.port or 80
            ip = self.target(url.hostname, port)
            length = int(self.headers.get("Content-Length", "0"))
            if (
                length < 0
                or length > 16 * 1024 * 1024
                or self.headers.get("Transfer-Encoding")
            ):
                raise ValueError()
            body = self.rfile.read(length)
            headers = {
                name: value
                for name, value in self.headers.items()
                if name.lower()
                not in {"proxy-authorization", "proxy-connection", "connection", "host"}
            }
            headers["Host"] = url.netloc
            connection = http.client.HTTPConnection(ip, port, timeout=30)
            try:
                connection.request(
                    self.command,
                    (url.path or "/") + ("?" + url.query if url.query else ""),
                    body,
                    headers,
                )
                response = connection.getresponse()
                self.send_response(response.status)
                for name, value in response.getheaders():
                    if name.lower() not in {"connection", "transfer-encoding"}:
                        self.send_header(name, value)
                self.send_header("Connection", "close")
                self.end_headers()
                while data := response.read(65536):
                    self.wfile.write(data)
            finally:
                connection.close()
        except (ValueError, OSError):
            try:
                self.send_error(403, "dependency destination denied")
            except OSError:
                pass
        self.close_connection = True

    do_HEAD = do_GET
    do_POST = do_GET
    do_PUT = do_GET
    do_DELETE = do_GET


def main():
    if not os.environ.get("ALLOWED_HOSTS"):
        raise RuntimeError("registered allowlist is required")
    ThreadingHTTPServer(("0.0.0.0", 3128), Proxy).serve_forever()


if __name__ == "__main__":
    main()
