from typing import Any


def api_response(data: Any = None, message: str = "success") -> dict:
    return {"message": message, "data": data}


def paginated_response(data: list, total: int, page: int, limit: int) -> dict:
    return {
        "message": "success",
        "data": data,
        "pagination": {
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit if limit else 0,
        },
    }
