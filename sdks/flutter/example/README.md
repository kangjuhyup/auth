# Flutter host setup

This directory contains the SDK usage entry point. Generate the platform host
files with the Flutter version selected by your application, then keep the
checked-in `lib/main.dart` and `pubspec.yaml`:

```sh
flutter create --platforms=android,ios .
```

For Android, register `com.example.app` as the AppAuth redirect scheme in the
app manifest or Gradle manifest placeholders. For iOS, register the same URL
scheme in `Info.plist`. Replace every `example.com` value in `lib/main.dart`
with the issuer, client, redirect, logout redirect, and API resource registered
for your tenant before running the app.
