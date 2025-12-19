# Adcash Anti-Adblock Configuration
# Zone IDs for different websites from the Adcash dashboard

ADCASH_ZONES = {
    'hiredalways.com': 'hkqscsmnjy',
    'coderchallenges.com': '8y4olj93dr',
    '3dmodelgenerators.com': 'hkvpc1qbmq',
    'answermatepro.com': 'mtckulgwdu',
    'bibletrumper.net': 'yzv2ihe3gn',
    'collegeaibots.com': 'bpvwjuoecq',
    'collegeaibot.com': '7pbozszikc',
    'ingredienthelper.com': 'ie9ycjapmy',
    'graphixcamera.com': '2fsehinytl',
    'lowbudgetbuddy.com': 'hnhupo6pwv'
}

# Configuration settings
ANTI_ADBLOCK_CONFIG = {
    'update_frequency_minutes': 5,
    'library_filename_prefix': 'lib-',
    'library_path': '/static/js/',
    'enabled': True
}

def get_zone_id(domain):
    """Get the zone ID for a specific domain"""
    return ADCASH_ZONES.get(domain)

def get_primary_zone_id():
    """Get the primary zone ID for the main domain"""
    return ADCASH_ZONES.get('hiredalways.com', 'hkqscsmnjy')