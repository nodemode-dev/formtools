import pytest


@pytest.fixture
def tab(client):
    from .support import tab_token

    with tab_token() as headers:
        yield headers


@pytest.fixture
def no_catalogue(client):
    from app.services import bridge

    kept = bridge.catalogue()
    bridge.mirror([])
    yield
    bridge.mirror(kept)
