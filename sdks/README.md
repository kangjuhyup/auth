# Client SDKs

Client SDKs are independently versioned packages that integrate only through
the Auth Platform public OIDC contract. They must not import server internals,
persistence models, or secrets.

| Package | Status | Toolchain |
| --- | --- | --- |
| [`flutter`](flutter/) | `0.1.0-dev.1` skeleton | Flutter 3.22+ / Dart 3.4+ |

The Flutter package is not a Yarn workspace and is not included in the Auth
service container image. Before publishing any SDK, select and add the
repository's open-source license; the current root package is still marked
`UNLICENSED`.
