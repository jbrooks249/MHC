def calculate_ai_score(property_data):
    """
    Calculate AI score for a property (0-100).
    
    Rules:
    +20 if units >= 45
    +25 if cap_rate > 7
    +15 if occupancy > 85
    +30 if mom_pop == true
    +10 if price_per_unit < 45000
    """
    score = 0

    # +20 if units >= 45
    if property_data.get('units', 0) >= 45:
        score += 20

    # +25 if cap_rate > 7
    if property_data.get('cap_rate', 0) > 7:
        score += 25

    # +15 if occupancy > 85
    if property_data.get('occupancy', 0) > 85:
        score += 15

    # +30 if mom_pop == true
    if property_data.get('mom_pop', False):
        score += 30

    # +10 if price_per_unit < 45000
    units = property_data.get('units', 1)
    asking_price = property_data.get('asking_price', 0)
    if units > 0:
        price_per_unit = asking_price / units
        if price_per_unit < 45000:
            score += 10

    return min(score, 100)  # Max 100
