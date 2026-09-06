# src\parsers\base.py
from abc import ABC, abstractmethod


class BaseParser(ABC):

    def __init__(self, html_path):
        self.html_path = html_path

    @abstractmethod
    def parse(self):
        pass