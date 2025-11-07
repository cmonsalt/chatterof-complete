#!/bin/bash

# Script para arreglar todos los archivos API con Supabase hardcoded

SUPABASE_URL="https://fhqdxsixcdbdltijxnzb.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZocWR4c2l4Y2RiZGx0aWp4bnpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU5NjA1NTYsImV4cCI6MjA1MTUzNjU1Nn0.gqKcN_bHDQKXwwEGKsRDtQ2kpDKO7rUgTXQgvnxq1Yc"

# Lista de archivos a arreglar
FILES=(
  "webhook.js"
  "send-message.js"
  "sync-chats.js"
  "sync-fans.js"
  "get-vault.js"
  "get-messages.js"
  "setup-account.js"
  "sync-transactions.js"
  "check-connection.js"
  "check-notifications.js"
  "cron-check-notifications.js"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Arreglando $file..."
    sed -i "s|process.env.VITE_SUPABASE_URL|'$SUPABASE_URL'|g" "$file"
    sed -i "s|process.env.VITE_SUPABASE_ANON_KEY|'$SUPABASE_KEY'|g" "$file"
  fi
done

echo "✅ Todos los archivos arreglados"
