from fastapi import APIRouter


# Instance operation HTTP endpoints are added in 03-D7. Keeping this router
# mounted now gives the runtime module a single public integration point.
router = APIRouter(tags=["runtime"])
