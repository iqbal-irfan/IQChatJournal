# src\models.py
from dataclasses import dataclass
from enum import Enum


class Role(Enum):
    USER = "user"
    ASSISTANT = "assistant"


@dataclass
class ChatMessage:
    role: Role
    element: object