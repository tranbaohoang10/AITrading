# AI Trading Platform

AI-assisted, method-neutral platform for converting prompts, images, documents, and trading rules into validated Strategy DSL; running deterministic Python backtests across multiple symbols, timeframes, and periods; and generating Pine Script or MQL5 from the same approved DSL version.

## Planned technology

- Frontend: React + TypeScript + Vite
- Backend: Spring Boot + Java 21 + Gradle Kotlin DSL
- Database: PostgreSQL + Flyway
- AI/Quant service: Python
- RAG: OpenDataLoader PDF + Spring AI/Python retrieval + pgvector
- Market data: Binance, CCXT, MetaTrader 5, local Parquet/CSV
- Targets: Python backtest, Pine Script v6, MQL5
- Agent workflow: Agent 1 Analyst/Architect, Agent 2 Developer, Agent 3 Independent Tester

## Strategy neutrality

The platform must not default to ICT or SMC. Dow Theory, Wyckoff, trendlines, price action, ICT/SMC, RSI, EMA, SMA, other indicators, and custom or hybrid strategies are represented through neutral Strategy DSL components.

## Agent governance

Read `AGENTS.md`, `.specify/memory/constitution.md`, and `docs/agent-skills.md` before agent-driven work.
