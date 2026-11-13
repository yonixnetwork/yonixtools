from app.ratelimit import RateLimiter


def test_sliding_window():
    rl = RateLimiter(3, 60)
    assert [rl.hit("a", now=t)[0] for t in (0, 1, 2, 3)] == [True, True, True, False]
    assert rl.hit("b", now=3)[0] is True
    ok, retry = rl.hit("a", now=10)
    assert not ok and 50 <= retry <= 52
    assert rl.hit("a", now=61)[0] is True


def test_prune_bounds_memory():
    rl = RateLimiter(1, 1, max_keys=10)
    for i in range(50):
        rl.hit(str(i), now=i * 2)
    assert len(rl._hits) <= 11
