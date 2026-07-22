from __future__ import annotations

from dataclasses import dataclass

from .contracts import BridgeSignal


@dataclass(frozen=True)
class Scenario:
    scenario_id: str
    days: int
    seed: int
    signals: tuple[BridgeSignal, ...]
    description: str


def required_scenarios() -> tuple[Scenario, ...]:
    return (
        Scenario("no-hermes-1d", 1, 11, (), "Un día completo sin tareas Hermes."),
        Scenario(
            "normal-1d",
            1,
            12,
            tuple(_normal_signals(1)),
            "Carga normal repartida entre los cuatro perfiles.",
        ),
        Scenario(
            "overloaded-zerny-1d",
            1,
            13,
            tuple(_overload_signals("zerny", 8)),
            "Un perfil recibe ocho tareas; se ejercitan rendimientos decrecientes.",
        ),
        Scenario(
            "concurrent-elen-1d",
            1,
            14,
            (
                _signal("con-a-start", "elen", "a", "activity.started", 120),
                _signal("con-b-start", "elen", "b", "activity.started", 150),
                _signal("con-a-end", "elen", "a", "activity.completed", 240),
                _signal("con-b-end", "elen", "b", "activity.completed", 300),
            ),
            "Dos sesiones simultáneas para Elen; una termina mientras otra continúa.",
        ),
        Scenario(
            "interruptions-1d",
            1,
            15,
            (
                _signal("err-start", "default", "err", "activity.started", 120),
                _signal("err-end", "default", "err", "activity.failed", 180),
                _signal("int-start", "astrelis", "int", "activity.started", 240),
                _signal("int-end", "astrelis", "int", "activity.interrupted", 300),
                _signal("wait-start", "zerny", "wait", "activity.started", 360),
                _signal("wait", "zerny", "wait", "activity.waiting", 390),
                _signal("resume", "zerny", "wait", "activity.resumed", 450),
                _signal("wait-end", "zerny", "wait", "activity.completed", 510),
            ),
            "Errores, interrupción y espera sin castigo económico.",
        ),
        Scenario(
            "normal-7d",
            7,
            16,
            tuple(_normal_signals(7)),
            "Siete días para comprobar rutinas y misión semanal.",
        ),
        Scenario(
            "normal-30d",
            30,
            17,
            tuple(_normal_signals(30)),
            "Treinta días para observar balances, necesidades e inflación.",
        ),
    )


def _normal_signals(days: int):
    profiles = ("default", "elen", "astrelis", "zerny")
    for day in range(days):
        for index, profile in enumerate(profiles):
            start = day * 1440 + 120 + index * 75
            session = f"day-{day}-{profile}"
            yield _signal(f"{session}-start", profile, session, "activity.started", start)
            yield _signal(f"{session}-end", profile, session, "activity.completed", start + 60)


def _overload_signals(profile: str, tasks: int):
    for index in range(tasks):
        start = 60 + index * 90
        session = f"overload-{index}"
        yield _signal(f"{session}-start", profile, session, "activity.started", start)
        yield _signal(f"{session}-end", profile, session, "activity.completed", start + 45)


def _signal(
    signal_id: str, profile: str, session: str, event_type: str, minute: int
) -> BridgeSignal:
    return BridgeSignal(signal_id, profile, session, event_type, minute)
