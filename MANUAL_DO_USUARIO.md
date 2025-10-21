# 📖 MANUAL DO USUÁRIO - SISTEMA DE MARCOS GEODÉSICOS FHV-COGEP

**Versão:** 1.0  
**Data:** Outubro 2025  
**Desenvolvido para:** COGEP - Consultoria em Geodésia e Topografia

---

## 📑 ÍNDICE

1. [Introdução](#introdução)
2. [Acesso ao Sistema](#acesso-ao-sistema)
3. [Interface Principal](#interface-principal)
4. [Aba Consulta](#aba-consulta)
5. [Aba Mapa](#aba-mapa)
6. [Aba Importar](#aba-importar)
7. [Aba Exportar](#aba-exportar)
8. [Perguntas Frequentes](#perguntas-frequentes)
9. [Suporte Técnico](#suporte-técnico)

---

## 1. INTRODUÇÃO

### O Que é o Sistema?

O **Sistema de Marcos Geodésicos FHV-COGEP** é uma plataforma web desenvolvida para gerenciar e visualizar marcos geodésicos do IBGE utilizados pela COGEP em projetos de georeferenciamento.

### Funcionalidades Principais

- ✅ **Consultar** marcos por código, tipo ou município
- ✅ **Visualizar** marcos em mapa interativo
- ✅ **Importar** novos marcos de planilhas Excel
- ✅ **Exportar** dados para Excel
- ✅ **Filtrar** por tipo (Vértice, Marco, Ponto de Satélite)

### Tipos de Marcos

| Tipo | Nome Completo | Descrição |
|------|---------------|-----------|
| **V** | Vértice de Triangulação | Marcos de alta precisão da rede geodésica nacional |
| **M** | Marco de Nivelamento | Marcos para determinação de altitudes |
| **P** | Ponto de Satélite | Pontos GNSS de referência |

---

## 2. ACESSO AO SISTEMA

### Requisitos

- **Navegador:** Chrome, Firefox, Edge ou Safari (versões recentes)
- **Conexão:** Internet estável
- **Resolução:** Mínimo 1280x720 pixels

### Como Acessar

1. Abra seu navegador
2. Digite o endereço: **http://localhost:3000** (ou URL de produção)
3. O sistema carregará automaticamente

---

## 3. INTERFACE PRINCIPAL

### Estrutura da Tela

```
┌─────────────────────────────────────────────────────┐
│  🗺️ SISTEMA DE MARCOS GEODÉSICOS FHV-COGEP          │
├─────────────────────────────────────────────────────┤
│  [Consulta] [Mapa] [Importar] [Exportar]           │
├─────────────────────────────────────────────────────┤
│                                                     │
│                 CONTEÚDO DA ABA                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Navegação

- **Clique nas abas** para alternar entre funcionalidades
- **Aba ativa** fica destacada em azul
- **Conteúdo muda** automaticamente ao trocar de aba

---

## 4. ABA CONSULTA

### Visão Geral

A aba **Consulta** permite buscar marcos cadastrados no sistema usando diversos critérios.

### Como Usar

#### 4.1. Busca Básica

1. Digite o código do marco (ex: `FHV-M-0001`)
2. Clique em **Buscar**
3. Resultados aparecem na tabela abaixo

#### 4.2. Filtros Avançados

**Filtrar por Tipo:**
- Clique no dropdown "Tipo"
- Selecione: Todos, V (Vértice), M (Marco), ou P (Ponto)
- Clique em **Buscar**

**Filtrar por Município:**
- Digite o nome do município (ex: `Londrina`)
- Clique em **Buscar**

**Filtrar por Status:**
- Selecione: "Levantado" ou "Pendente"
- **Levantado:** Marcos com coordenadas conhecidas
- **Pendente:** Marcos cadastrados mas ainda não levantados

#### 4.3. Tabela de Resultados

A tabela mostra:
- **Código:** Identificador único (ex: FHV-M-0162)
- **Tipo:** V, M ou P
- **Município:** Localização do marco
- **Estado:** Sempre PR (Paraná)
- **Status:** LEVANTADO ou PENDENTE
- **Coordenadas:** Latitude e Longitude (se disponível)

#### 4.4. Ações na Tabela

- **Ver no Mapa:** Clique no ícone 📍 para localizar o marco no mapa
- **Detalhes:** Clique na linha para ver informações completas
- **Ordenar:** Clique nos cabeçalhos das colunas para ordenar

---

## 5. ABA MAPA

### Visão Geral

A aba **Mapa** exibe todos os marcos levantados em um mapa interativo.

### Elementos do Mapa

#### 5.1. Clusters

Quando há muitos marcos próximos, eles são agrupados em **clusters**:

```
┌─────────┐
│  🔵 218  │  ← Cluster com 218 marcos
└─────────┘
```

**Como usar:**
- Clique no cluster para aproximar (zoom)
- Continue clicando até ver marcos individuais

#### 5.2. Marcos Individuais

Quando aproximado o suficiente, marcos aparecem como pins individuais:

```
📍 ← Marco individual
```

**Cores dos pins:**
- 🔵 Azul: Marco tipo V (Vértice)
- 🟢 Verde: Marco tipo M (Marco de Nivelamento)
- 🟡 Amarelo: Marco tipo P (Ponto de Satélite)

#### 5.3. Popup de Informações

Clique em um marco para ver:
- Código do marco
- Tipo
- Município
- Coordenadas (Latitude/Longitude)
- Altitude (se disponível)
- Data de levantamento

### Controles do Mapa

#### Navegação
- **Arrastar:** Clique e arraste para mover o mapa
- **Zoom:** Use a roda do mouse ou botões +/- no canto
- **Duplo clique:** Aproxima rapidamente

#### Camadas
- **Mapa Base:** OpenStreetMap (padrão)
- **Satélite:** (se configurado) Imagens de satélite

### Dicas de Uso

✅ **Carregamento inicial:** Aguarde alguns segundos para todos os marcos aparecerem  
✅ **Muitos marcos:** Use os clusters para navegar mais facilmente  
✅ **Localização específica:** Use a busca na aba Consulta primeiro  
✅ **Performance:** Quanto mais zoom, menos marcos carregados = mais rápido

---

## 6. ABA IMPORTAR

### Visão Geral

A aba **Importar** permite adicionar novos marcos ao sistema via planilha Excel.

### Formato da Planilha

#### Colunas Obrigatórias:

| Coluna | Tipo | Exemplo | Observações |
|--------|------|---------|-------------|
| `codigo` | Texto | FHV-M-0001 | Identificador único |
| `tipo` | Texto | M | V, M ou P |
| `municipio` | Texto | Londrina | Nome do município |
| `coordenada_e` | Número | 650589.8882 | Coordenada X (UTM) em metros |
| `coordenada_n` | Número | 7192069.4339 | Coordenada Y (UTM) em metros |

#### Colunas Opcionais:

- `altitude`: Altitude elipsoidal em metros
- `data_levantamento`: Data no formato DD/MM/AAAA
- `metodo`: RTK, PPP, Estático, etc.
- `precisao_horizontal`: Precisão em metros
- `precisao_vertical`: Precisão em metros
- `observacoes`: Texto livre

### Como Importar

1. **Preparar planilha:**
   - Abra Excel
   - Organize dados nas colunas corretas
   - Salve como `.xlsx` ou `.csv`

2. **No sistema:**
   - Clique na aba **Importar**
   - Clique em **Escolher Arquivo**
   - Selecione sua planilha
   - Clique em **Importar**

3. **Aguardar processamento:**
   - Barra de progresso aparece
   - Sistema valida dados
   - Converte coordenadas UTM para Lat/Lng automaticamente

4. **Verificar resultado:**
   - Mensagem de sucesso/erro
   - Ver novos marcos na aba **Mapa**

### Validações

O sistema verifica automaticamente:

✅ **Códigos únicos** (não permite duplicatas)  
✅ **Tipo válido** (apenas V, M ou P)  
✅ **Coordenadas no formato correto** (números, não texto)  
✅ **Coordenadas dentro do Brasil** (validação geográfica)

### Erros Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| "Código duplicado" | Marco já existe | Use código diferente ou atualize existente |
| "Tipo inválido" | Tipo diferente de V, M ou P | Corrigir para V, M ou P |
| "Coordenadas inválidas" | Formato errado ou valores absurdos | Verificar formato UTM (ex: 650589.88) |
| "Arquivo não suportado" | Formato incorreto | Usar apenas .xlsx ou .csv |

---

## 7. ABA EXPORTAR

### Visão Geral

A aba **Exportar** permite baixar todos os dados em formato Excel.

### Como Exportar

1. Clique na aba **Exportar**
2. Clique no botão **Exportar para Excel**
3. Arquivo será baixado automaticamente
4. Abra o arquivo no Excel

### Conteúdo do Arquivo

O arquivo exportado contém:

- **Todas as colunas** do banco de dados
- **Todos os marcos** (levantados + pendentes)
- **Formatação** preservada
- **Coordenadas** em decimal (ex: -25.380556)

### Usos Comuns

- ✅ **Backup** dos dados
- ✅ **Análise** em Excel ou outras ferramentas
- ✅ **Compartilhamento** com equipe
- ✅ **Impressão** de relatórios
- ✅ **Integração** com outros sistemas

---

## 8. PERGUNTAS FREQUENTES

### Geral

**P: Quantos marcos o sistema suporta?**  
R: Atualmente 19.041 marcos cadastrados, sem limite técnico definido.

**P: O sistema funciona offline?**  
R: Não, requer conexão com internet para carregar o mapa base.

**P: Posso acessar de celular/tablet?**  
R: Sim, mas a experiência é otimizada para desktop.

### Consulta

**P: Como buscar marcos próximos a uma localização?**  
R: Use a aba Mapa, aproxime a região desejada e visualize os markers.

**P: Posso buscar por coordenadas?**  
R: Não diretamente. Use o mapa e aproxime visualmente.

### Mapa

**P: Por que alguns marcos não aparecem?**  
R: Apenas marcos "LEVANTADOS" (com coordenadas) aparecem. Marcos "PENDENTES" não têm localização conhecida.

**P: O mapa demora para carregar?**  
R: Com 218 marcos levantados, o carregamento leva 1-3 segundos. Use clusters para melhor performance.

**P: Posso mudar o tipo de mapa (satélite)?**  
R: Atualmente não. Futura versão incluirá esta opção.

### Importar

**P: Posso importar marcos sem coordenadas?**  
R: Sim, eles serão cadastrados como "PENDENTES" e não aparecerão no mapa.

**P: O sistema aceita coordenadas geográficas (graus/minutos/segundos)?**  
R: Não. Use apenas coordenadas UTM (SIRGAS2000 Zone 22S).

**P: Posso importar fotos dos marcos?**  
R: Não na versão atual. Recurso planejado para futuras versões.

### Exportar

**P: Posso escolher quais colunas exportar?**  
R: Não na versão atual. A exportação inclui todas as colunas.

**P: O Excel não abre o arquivo corretamente. O que fazer?**  
R: Certifique-se de ter Excel 2010 ou superior. Ou use Google Sheets.

---

## 9. SUPORTE TÉCNICO

### Contato

**Desenvolvimento:**  
Sistema desenvolvido por Claude + Equipe COGEP

**Email:**  
suporte@cogep.com.br (exemplo)

**Horário:**  
Segunda a Sexta, 8h às 18h

### Reportar Problemas

Ao reportar um problema, inclua:

1. ✅ Descrição detalhada do erro
2. ✅ Passos para reproduzir
3. ✅ Navegador utilizado
4. ✅ Print da tela (se possível)
5. ✅ Mensagem de erro exata

### Solicitação de Recursos

Tem uma ideia de melhoria? Entre em contato com:

- Descrição da funcionalidade desejada
- Caso de uso (para que serve)
- Prioridade (baixa/média/alta)

---

## 📊 ESTATÍSTICAS DO SISTEMA

**Última atualização:** Outubro 2025

- **Total de marcos:** 19.041
- **Marcos levantados:** 218 (1,1%)
- **Marcos pendentes:** 18.823 (98,9%)
- **Estados cobertos:** Paraná (expansão planejada)
- **Tipos de marcos:**
  - Vértices (V): 3.313
  - Marcos (M): 6.927
  - Pontos de Satélite (P): 8.801

---

## 🎯 ROADMAP - PRÓXIMAS VERSÕES

### Versão 1.1 (Planejada)
- ✨ Upload de fotos dos marcos
- ✨ Busca por raio
- ✨ Filtros no mapa por tipo

### Versão 2.0 (Planejada)
- ✨ Autenticação de usuários
- ✨ Edição de marcos
- ✨ Histórico de alterações
- ✨ Mapa satélite

### Versão 3.0 (Planejada)
- ✨ App mobile/PWA
- ✨ Navegação até marcos
- ✨ Coleta em campo
- ✨ Relatórios em PDF

---

**Versão do Manual:** 1.0  
**Data:** Outubro 2025  
**© COGEP - Todos os direitos reservados**
