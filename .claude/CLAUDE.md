# Configuração de Debugging Automático - Claude Code

## Informações do Projeto
- **Nome**: Sistema de Gerenciamento de Marcos Geodésicos FHV
- **URL da Aplicação**: http://localhost:3001
- **Backend**: Node.js + Express (porta 5434)
- **Frontend**: HTML5 + Leaflet.js + Supercluster
- **Sistema de Coordenadas**: SIRGAS2000 UTM Zone 22S (EPSG:31982)

## Playwright MCP - Instruções de Uso

### Quando Usar o Playwright
Você DEVE usar o Playwright MCP para:
- Executar testes automatizados na aplicação web
- Capturar logs do console em tempo real
- Identificar e reportar erros JavaScript
- Monitorar requisições de rede
- Fazer capturas de tela quando erros ocorrem
- Validar correções de código

### Como Executar Testes

#### Opção 1: Usar o Script Configurado
```bash
npm run debug
```

### Fluxo de Debugging Recomendado

1. **ANTES de fazer mudanças no código:**
   - Execute `npm run debug` para capturar o estado atual
   - Documente os erros encontrados

2. **DEPOIS de fazer mudanças:**
   - Execute `npm run debug` novamente
   - Compare os resultados
   - Confirme se os erros foram resolvidos

3. **Se erros persistirem:**
   - Analise os logs capturados
   - Identifique a linha de código problemática
   - Faça ajustes incrementais
   - Teste novamente

### Erro Atual Conhecido
**Erro**: "Sistema de clustering não inicializado"
**Local**: frontend/script.js
**Causa provável**: Supercluster não está sendo inicializado antes de `atualizarMarcadores()` ser chamado

### Arquivos Principais
- `frontend/script.js` - Lógica principal do frontend
- `frontend/index.html` - HTML principal
- `backend/server.js` - Servidor Express
- `playwright-debug-config.js` - Configuração de debugging

### Quando Detectar um Erro
1. Capture o estado atual da página
2. Analise os logs de console relacionados
3. Identifique a linha de código problemática
4. Sugira uma correção específica
5. Implemente a correção
6. Execute `npm run debug` para validar
7. Confirme que o erro foi resolvido

### Padrões de Código
- Use `console.log('✅ ...')` para sucesso
- Use `console.error('❌ ...')` para erros
- Use `console.warn('⚠️  ...')` para avisos
- Sempre adicione try-catch em código assíncrono
- Valide variáveis antes de usar
