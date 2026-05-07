from abc import ABC, abstractmethod
from typing import List, Dict
from scoring import calculate_ai_score
from config import MIN_UNITS, EXCLUDED_STATES
import uuid


class PropertyDataSource(ABC):
    """Abstract base class for property data sources."""

    @abstractmethod
    def fetch_properties(self) -> List[Dict]:
        """Fetch properties from the data source."""
        pass

    def filter_and_score(self, properties: List[Dict]) -> List[Dict]:
        """Apply hard filters and calculate AI scores."""
        filtered = []

        for prop in properties:
            # Hard filter: units >= 45
            if prop.get('units', 0) < MIN_UNITS:
                continue

            # Hard filter: exclude West Coast
            if prop.get('state', '').upper() in EXCLUDED_STATES:
                continue

            # Calculate AI score
            ai_score = calculate_ai_score(prop)

            # Add computed fields
            prop['ai_score'] = ai_score
            if 'id' not in prop:
                prop['id'] = str(uuid.uuid4())

            filtered.append(prop)

        return filtered


class LoopNetSource(PropertyDataSource):
    """LoopNet MHC listing source."""

    def fetch_properties(self) -> List[Dict]:
        """
        Fetch from LoopNet (mock structure).
        In production, this would call LoopNet API or scrape listings.
        """
        print('Fetching from LoopNet...')

        # Mock data
        properties = [
            {
                'name': 'Sunset Ridge Community',
                'address': '123 Main St',
                'city': 'Austin',
                'state': 'TX',
                'region': 'South',
                'units': 150,
                'occupancy': 92.5,
                'cap_rate': 8.2,
                'asking_price': 6500000,
                'noi': 533000,
                'mom_pop': True,
                'source': 'LoopNet',
            },
        ]

        return self.filter_and_score(properties)


class CrexiSource(PropertyDataSource):
    """Crexi MHC listing source."""

    def fetch_properties(self) -> List[Dict]:
        """
        Fetch from Crexi (mock structure).
        In production, this would call Crexi API or scrape listings.
        """
        print('Fetching from Crexi...')

        # Mock data
        properties = [
            {
                'name': 'Pine Valley Estates',
                'address': '456 Oak Ave',
                'city': 'Dallas',
                'state': 'TX',
                'region': 'South',
                'units': 120,
                'occupancy': 88.0,
                'cap_rate': 7.5,
                'asking_price': 5200000,
                'noi': 390000,
                'mom_pop': True,
                'source': 'Crexi',
            },
        ]

        return self.filter_and_score(properties)


def merge_properties(*sources: PropertyDataSource) -> List[Dict]:
    """
    Merge properties from multiple sources, deduplicating by name/city/state.
    """
    all_properties = []
    seen = set()

    for source in sources:
        properties = source.fetch_properties()
        for prop in properties:
            # Create unique key
            key = (prop['name'].lower(), prop['city'].lower(), prop['state'].upper())

            if key not in seen:
                all_properties.append(prop)
                seen.add(key)

    return all_properties
