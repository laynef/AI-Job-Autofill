import pytest
import adcash_config

pytestmark = pytest.mark.unit


def test_get_zone_id_known_domain():
    assert adcash_config.get_zone_id("hiredalways.com") == "hkqscsmnjy"


def test_get_zone_id_unknown_domain():
    assert adcash_config.get_zone_id("unknown.example") is None


def test_get_primary_zone_id():
    assert adcash_config.get_primary_zone_id() == "hkqscsmnjy"
