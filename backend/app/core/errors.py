from fastapi import HTTPException


def abort(code, message, status=409, retryable=False):
    raise HTTPException(status_code=status, detail={'code': code, 'message': message, 'retryable': retryable})
