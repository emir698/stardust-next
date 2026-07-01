#!/bin/bash
# Stardust Gate — APK Build + Firebase Deploy
# Kullanım: ./deploy-gate.sh
# Mac'te stardust-next klasöründen çalıştır.

set -e

SURU=${1:-"1.0.0"}   # ./deploy-gate.sh 1.1.0 şeklinde sürüm verebilirsin
TARIH=$(date "+%d.%m.%Y")

echo ""
echo "🔨  APK build ediliyor (v$SURU)..."
cd android-native
JAVA_HOME=/opt/homebrew/opt/openjdk@17 ./gradlew clean assembleDebug
cd ..

echo ""
echo "📦  APK kopyalanıyor..."
cp android-native/app/build/outputs/apk/debug/app-debug.apk gate-hosting/stardust-gate.apk

echo ""
echo "🗂   Sürüm bilgisi güncelleniyor (v$SURU - $TARIH)..."
cat > gate-hosting/version.json << EOF
{
  "version": "$SURU",
  "date": "$TARIH"
}
EOF

echo ""
echo "🚀  Firebase Hosting'e deploy ediliyor..."
firebase deploy --only hosting

echo ""
echo "✅  Tamamlandı!"
echo "    Link: https://box-office-discount.web.app"
echo ""
