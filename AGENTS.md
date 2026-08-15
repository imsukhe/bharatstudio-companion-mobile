# Repository instructions

Read `../bharatstudio-requirements/governance/AGENTS.md` before any action. This app is a client of the server-authorized API and entitlement contract. It must not directly control OBS, store raw OBS secrets, perform checkout, or decide access locally. All control actions require authorised desktop-helper mediation and auditable server policy.
