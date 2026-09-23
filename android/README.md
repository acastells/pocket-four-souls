# Android

El anfitrión es Java + WebView; interfaz, motor y cartas son los mismos que en la web.
Requiere Android 8+ con WebView actualizado. Orientación `sensorLandscape`, sin scroll,
solitario local y almacenamiento propio de la app. No utiliza Capacitor.

## Compilar

Además de `npm ci`, necesitas Python 3, JDK 17+ (con compilador), Android SDK Platform 35
y Build Tools 35.0.0. Instálalos con Android Studio/SDK Manager desde las fuentes oficiales.
Las rutas dependen de tu equipo; sustituye las del ejemplo:

```sh
python android/build-apk.py --tools /sdk/build-tools/35.0.0 --platform /sdk/platforms/android-35/android.jar --java /jdk/bin/java
```

Salida: `mobile-output/four-souls-pocket.apk`. El script compila React, Java, D8,
AAPT2 y zipalign; firma con apksigner y verifica la firma. No necesita Gradle.

Sin `--origin`, usa `https://pocket.invalid`: las cartas y el solitario funcionan
con los recursos empaquetados; las salas no tienen un servidor disponible.
Para online, despliega el servidor local detrás de HTTPS y compila con:

```sh
python android/build-apk.py --tools /sdk/build-tools/35.0.0 --platform /sdk/platforms/android-35/android.jar --java /jdk/bin/java --origin https://tu-servidor.example
```

Usa un origen real con certificado válido, sin ruta. El código no desactiva la
verificación TLS ni incluye tokens de Sites. Solo intercepta `/pocket-native/`
para servir recursos locales; `/api/room` llega al backend configurado.

La web y la APK deben apuntar al mismo servidor para compartir salas. `localhost`
en Android apunta al teléfono, no a tu ordenador. Para pruebas LAN rápidas usa la
versión web en el navegador; la APK requiere HTTPS para su backend.

## Firma

La primera compilación genera `android/pocket-test.keystore`, con alias `androiddebugkey`
y contraseña `android`. Es una firma de pruebas para instalación directa, no una
configuración de publicación en Google Play. Conserva una copia privada de esa clave
para futuras actualizaciones de tus APK. No se incluye ninguna clave antigua.
Una clave nueva no permite actualizar encima de la APK anterior con otra firma.

El código Android y su script se incluyen como fuente; no se ha recompilado ni probado
esta edición en un dispositivo durante la preparación del ZIP. La verificación de la
web no sustituye la validación Android. En macOS/Linux puede que el comando sea `python3`.
