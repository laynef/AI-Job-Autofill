import os
import pytest

pytestmark = [pytest.mark.mobile, pytest.mark.integration]


def _simulators_available() -> bool:
    # Expect external tooling to be provisioned by CI or local dev.
    # These env vars are simple toggles to opt in when simulators are ready.
    return os.environ.get("RUN_IOS_SIM") == "1" and os.environ.get("RUN_ANDROID_SIM") == "1"


def test_ios_simulator_flow():
    if not _simulators_available():
        pytest.skip("iOS/Android simulators not configured. Set RUN_IOS_SIM=1 and RUN_ANDROID_SIM=1 to enable.")

    # Placeholder for Appium-based iOS flow.
    # When Appium + iOS Simulator are available, replace with real driver flow.
    assert True


def test_android_simulator_flow():
    if not _simulators_available():
        pytest.skip("iOS/Android simulators not configured. Set RUN_IOS_SIM=1 and RUN_ANDROID_SIM=1 to enable.")

    # Placeholder for Appium-based Android flow.
    # When Appium + Android Emulator are available, replace with real driver flow.
    assert True
