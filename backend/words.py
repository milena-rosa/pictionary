import random
from typing import List, Optional

WORD_CATEGORIES = {
    "animals": [
        "cat",
        "dog",
        "elephant",
        "giraffe",
        "penguin",
        "lion",
        "zebra",
        "bear",
        "fox",
        "owl",
    ],
    "objects": [
        "chair",
        "table",
        "book",
        "computer",
        "phone",
        "bottle",
        "window",
        "door",
        "lamp",
        "shoe",
    ],
    "actions": [
        "running",
        "jumping",
        "sleeping",
        "eating",
        "reading",
        "singing",
        "dancing",
        "swimming",
        "writing",
        "driving",
    ],
    "places": [
        "mountain",
        "beach",
        "city",
        "forest",
        "desert",
        "island",
        "school",
        "hospital",
        "park",
        "store",
    ],
    "expressions": [
        "break a leg",
        "piece of cake",
        "raining cats and dogs",
        "bite the bullet",
        "hit the road",
        "butterflies in stomach",
    ],
}


def get_random_word(category: str, used_words: List[str]) -> Optional[str]:
    """Selects a random word from a category, avoiding already used words."""
    if category not in WORD_CATEGORIES:
        return None
    available_words = [
        word for word in WORD_CATEGORIES[category] if word not in used_words
    ]
    if not available_words:
        # If all words in category are used, reset for this category or pick from another
        return random.choice(WORD_CATEGORIES[category])  # Fallback: allow repetition
    return random.choice(available_words)
