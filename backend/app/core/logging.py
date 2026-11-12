"""Emit only operational fields, never arbitrary messages, arguments or traceback text."""
from datetime import datetime, timezone
import json
import logging
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path
import re

class JsonFormatter(logging.Formatter):
    def format(self,record):
        value={'time':datetime.now(timezone.utc).isoformat(),'level':record.levelname,'logger':record.name}
        for key in ('event','request_id','job_id','instance_id','operation_id','phase','error_code','duration_ms','status_code'):
            item=getattr(record,key,None)
            if isinstance(item,(int,float)) or isinstance(item,str) and re.fullmatch(r'[A-Za-z0-9_.:-]{1,160}',item): value[key]=item
        if record.exc_info: value['error_type']=record.exc_info[0].__name__
        return json.dumps(value,ensure_ascii=False)

def configure_logging(process):
    from app.config import settings
    formatter=JsonFormatter()
    stream=logging.StreamHandler(); stream.setFormatter(formatter)
    handlers=[stream]
    if settings.LOG_DIRECTORY:
        root=Path(settings.LOG_DIRECTORY); root.mkdir(parents=True,exist_ok=True,mode=0o700)
        file=TimedRotatingFileHandler(root/f'{process}.jsonl',when='midnight',backupCount=7,utc=True)
        file.setFormatter(formatter); handlers.append(file)
    logging.getLogger().handlers=handlers
    logging.getLogger().setLevel(logging.INFO)
    for name in ('uvicorn','uvicorn.error','uvicorn.access'):
        logger=logging.getLogger(name); logger.handlers=[]; logger.propagate=True
