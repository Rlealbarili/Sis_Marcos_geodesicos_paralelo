# 📋 TODO - Correções Prioritárias

## 🔴 URGENTE (Fazer AGORA - 1 hora)

### 1. Remover mensagens "Em Desenvolvimento"

- [ ] `frontend/index.html:548-551` - Remover div "Em Desenvolvimento" da tab Importar
- [ ] `frontend/index.html:1260` - Remover alert "Novo Marco em desenvolvimento"
- [ ] `frontend/index.html:1277` - Remover alert "Importação em desenvolvimento"
- [ ] `frontend/index.html:1282` - Remover alert "Nova Propriedade em desenvolvimento"
- [ ] `frontend/index.html:1287` - Remover alert "Novo Cliente em desenvolvimento"
- [ ] `frontend/index.html:3132` - Remover toast "DOCX em desenvolvimento"
- [ ] `frontend/index.html:3148` - Remover toast "Funcionalidade em desenvolvimento"

**Resultado esperado:** Sistema sem mensagens de bloqueio

---

## 🟠 IMPORTANTE (Hoje - 3 horas)

### 2. Implementar modais básicos

- [ ] Modal Novo Marco (1h)
  - Criar HTML do modal
  - Implementar função saveNovoMarco()
  - Conectar ao backend

- [ ] Modal Nova Propriedade (1h)
  - Criar HTML do modal
  - Implementar função saveNovaPropriedade()
  - Conectar ao POST /api/propriedades

- [ ] Modal Novo Cliente (1h)
  - Criar HTML do modal
  - Implementar função saveNovoCliente()
  - Conectar ao POST /api/clientes

**Resultado esperado:** Usuário consegue criar novos registros

---

## 🟡 RECOMENDADO (Esta semana - 1 hora)

### 3. Adicionar páginas ao menu

- [ ] Adicionar "SIGEF" ao menu principal
  - Link para sigef-manager.html
  - Ícone apropriado

- [ ] Adicionar "Análise Fundiária" ao menu
  - Link para analise-fundiaria.html
  - Ícone apropriado

- [ ] Decidir sobre tab "Histórico"
  - Implementar conteúdo OU
  - Remover do menu

**Resultado esperado:** Todas funcionalidades acessíveis

---

## 🟢 MANUTENÇÃO (15 minutos)

### 4. Arquivar código obsoleto

- [ ] Criar pasta `backend/archived/`
- [ ] Mover `backend/server.js` para archived
- [ ] Criar pasta `frontend/archived/`
- [ ] Mover `frontend/exemplo-card.html` para archived
- [ ] Mover `frontend/exemplo-premium.html` para archived
- [ ] Adicionar `archived/.gitignore` (opcional)

**Resultado esperado:** Repositório limpo

---

## ✅ CRITÉRIOS DE CONCLUSÃO

- Sistema sem mensagens "Em Desenvolvimento"
- Modais de criação funcionando
- Todas páginas acessíveis pelo menu
- Código obsoleto arquivado
- Score aumenta de 83% para 95%

---

**Tempo total estimado: 5 horas**
