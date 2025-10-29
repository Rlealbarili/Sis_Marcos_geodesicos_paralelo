#!/bin/bash

echo ""
echo "🧹 Limpando sistema antigo..."
echo "============================================================"
echo ""

# Obter diretório raiz do projeto
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Criar pasta de arquivo
echo "📦 Criando pasta de arquivos..."
mkdir -p frontend/archived
echo "  ✅ Pasta frontend/archived/ criada"
echo ""

# Arquivar arquivos antigos
echo "📁 Arquivando arquivos antigos..."

# Verificar e mover index.html antigo (se existir)
if [ -f "frontend/index.html" ] && [ -f "frontend/index-premium.html" ]; then
    mv frontend/index.html frontend/archived/index.html.old
    echo "  ✅ index.html → archived/index.html.old"
elif [ -f "frontend/archived/index.html.old" ]; then
    echo "  ℹ️  index.html já foi arquivado anteriormente"
else
    echo "  ℹ️  index.html antigo não encontrado (pode já ter sido arquivado)"
fi

# Verificar e mover outros arquivos antigos
if [ -f "frontend/app.js" ]; then
    mv frontend/app.js frontend/archived/app.js.old
    echo "  ✅ app.js → archived/app.js.old"
fi

if [ -f "frontend/style.css" ]; then
    mv frontend/style.css frontend/archived/style.css.old
    echo "  ✅ style.css → archived/style.css.old"
fi

echo ""

# Renomear index-premium.html para index.html
echo "🔄 Ativando Sistema Premium..."
if [ -f "frontend/index-premium.html" ]; then
    mv frontend/index-premium.html frontend/index.html
    echo "  ✅ index-premium.html → index.html (ativado como padrão)"
elif [ -f "frontend/index.html" ]; then
    echo "  ✅ Sistema Premium já está ativo (index.html existe)"
else
    echo "  ❌ ERRO: Nenhum arquivo index encontrado!"
    exit 1
fi

echo ""
echo "============================================================"
echo "✅ Limpeza concluída com sucesso!"
echo "============================================================"
echo ""
echo "📊 Resultado:"
echo "  • Arquivos antigos movidos para: frontend/archived/"
echo "  • Sistema Premium ativado como padrão"
echo "  • URL de acesso: http://localhost:3001/"
echo ""
echo "📝 Documentação:"
echo "  • Consulte MIGRATION.md para detalhes da migração"
echo ""
echo "🚀 Próximos passos:"
echo "  1. Reiniciar o servidor:"
echo "     cd backend && npm start"
echo ""
echo "  2. Acessar o sistema:"
echo "     http://localhost:3001/"
echo ""
echo "⚠️  Para restaurar o sistema antigo (não recomendado):"
echo "     mv frontend/archived/index.html.old frontend/index-old.html"
echo ""
