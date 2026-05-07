#!/usr/bin/env python

"""
MHC Platform Scraper - Main entry point.

Runs data ingestion from configured sources,
applies filters and scoring, then pushes to Supabase.
"""

from data_source import LoopNetSource, CrexiSource, merge_properties
from database import upsert_properties
import sys


def main():
    print('\n🚀 MHC Acquisition Platform - Data Ingestion')
    print('=' * 50)

    try:
        # Initialize data sources
        print('\n📡 Initializing data sources...')
        sources = [
            LoopNetSource(),
            CrexiSource(),
        ]

        # Merge and filter
        print('\n🔍 Merging and filtering properties...')
        properties = merge_properties(*sources)
        print(f'✓ Found {len(properties)} qualifying properties')

        # Upsert to Supabase
        if properties:
            print('\n💾 Uploading to Supabase...')
            upsert_properties(properties)
            print('✓ Data ingestion complete!')
        else:
            print('⚠ No properties to upload')

        # Summary
        print('\n' + '=' * 50)
        print(f'Summary: {len(properties)} properties ingested')
        print('=' * 50 + '\n')

        return 0

    except Exception as e:
        print(f'\n✗ Error: {e}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
