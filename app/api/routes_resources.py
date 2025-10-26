# app/api/routes_resources.py
from fastapi import APIRouter

router = APIRouter(prefix="/api/resource", tags=["resource"])

@router.get("/calc")
async def calc_resource():
    """
    Демо endpoint для расчётных операций.
    """
    return {"message": "Resource calculation endpoint"}
