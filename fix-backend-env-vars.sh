#!/bin/bash

# Script para actualizar variables de entorno en archivos API
# Ejecutar desde la raíz del proyecto

echo "🔧 Actualizando archivos API con variables correctas..."
echo ""

# Lista de archivos a actualizar
FILES=(
  "api/onlyfans/webhook.js"
  "api/onlyfans/send-message.js"
  "api/onlyfans/sync-chats.js"
  "api/onlyfans/sync-fans.js"
  "api/onlyfans/get-vault.js"
  "api/onlyfans/get-messages.js"
  "api/onlyfans/setup-account.js"
  "api/onlyfans/sync-transactions.js"
  "api/onlyfans/check-connection.js"
  "api/onlyfans/check-notifications.js"
  "api/onlyfans/cron-check-notifications.js"
)

# Contador de archivos actualizados
UPDATED=0
NOT_FOUND=0

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "📝 Actualizando: $file"
    
    # Reemplazar VITE_SUPABASE_URL por SUPABASE_URL
    sed -i.bak 's/process\.env\.VITE_SUPABASE_URL/process.env.SUPABASE_URL/g' "$file"
    
    # Reemplazar VITE_SUPABASE_ANON_KEY por SUPABASE_ANON_KEY
    sed -i.bak 's/process\.env\.VITE_SUPABASE_ANON_KEY/process.env.SUPABASE_ANON_KEY/g' "$file"
    
    # Eliminar backup
    rm -f "${file}.bak"
    
    ((UPDATED++))
    echo "   ✅ Actualizado"
  else
    echo "⚠️  No encontrado: $file"
    ((NOT_FOUND++))
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 RESUMEN:"
echo "   ✅ Archivos actualizados: $UPDATED"
echo "   ⚠️  Archivos no encontrados: $NOT_FOUND"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🎯 SIGUIENTE PASO:"
echo "   1. Verifica los cambios con: git diff"
echo "   2. Asegúrate de agregar las variables en Vercel:"
echo "      • SUPABASE_URL"
echo "      • SUPABASE_ANON_KEY"
echo "   3. Commit y push:"
echo "      git add ."
echo "      git commit -m 'fix: usar variables backend correctas'"
echo "      git push"
echo ""
