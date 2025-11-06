# 🗺️ GUIA COMPLETO: SISTEMA SIGEF + ANÁLISE FUNDIÁRIA
**Sistema de Gerenciamento de Marcos Geodésicos FHV**

---

## 📋 ÍNDICE

1. [Visão Geral do Sistema](#visão-geral-do-sistema)
2. [Módulo SIGEF - Download e Importação](#módulo-sigef)
3. [Módulo Análise Fundiária](#módulo-análise-fundiária)
4. [Integração SIGEF + Análise Fundiária](#integração-sigef--análise-fundiária)
5. [Fluxo de Trabalho Completo](#fluxo-de-trabalho-completo)
6. [Casos de Uso Práticos](#casos-de-uso-práticos)
7. [Algoritmos e Cálculos](#algoritmos-e-cálculos)
8. [Resultados e Interpretação](#resultados-e-interpretação)

---

## 🎯 VISÃO GERAL DO SISTEMA

### O Que É?

O sistema combina **duas ferramentas poderosas** para análise geoespacial de propriedades rurais:

1. **SIGEF (Sistema de Gestão Fundiária)** - Download e importação de parcelas certificadas pelo INCRA
2. **Análise Fundiária** - Detecção de sobreposições e confrontantes entre propriedades

### Por Que Usar?

**Problema Resolvido:**
- Evitar aceitar trabalhos em áreas com conflitos fundiários
- Identificar sobreposições com propriedades certificadas no INCRA
- Conhecer confrontantes antes de iniciar levantamento
- Calcular risco e viabilidade de trabalhos topográficos

**Benefícios:**
- ✅ Decisões informadas antes de aceitar trabalho
- ✅ Redução de riscos jurídicos
- ✅ Conhecimento prévio de confrontantes
- ✅ Score de viabilidade automático (0-100)
- ✅ Visualização geoespacial completa

---

## 📥 MÓDULO SIGEF - DOWNLOAD E IMPORTAÇÃO

### O Que É o SIGEF?

**SIGEF (Sistema de Gestão Fundiária)** é a base de dados oficial do INCRA contendo **todas as parcelas rurais certificadas** no Brasil. Inclui:

- Geometrias georreferenciadas (polígonos)
- Dados do proprietário (nome, CPF/CNPJ)
- Número de matrícula
- Área certificada
- Data de certificação
- Responsável técnico

### Como Funciona o Download?

#### 1. Fonte de Dados
```
URL Base: https://certificacao.incra.gov.br/csv_shp/zip/
Formato: Imóvel certificado SNCI Brasil_{ESTADO}.zip
Estados Cobertos: PR, SC, RS, SP, MG, MS, GO, MT, DF
```

#### 2. Processo de Download Automatizado

```
┌─────────────────────────────────────────────────────┐
│ FLUXO DE DOWNLOAD SIGEF                             │
└─────────────────────────────────────────────────────┘

1. INICIAÇÃO
   ├─ Usuário seleciona estado (ex: PR)
   ├─ Sistema cria registro no banco: sigef_downloads
   └─ Status: "processando"

2. DOWNLOAD
   ├─ Construir URL: brasil_PR.zip
   ├─ Configurar HTTPS Agent (aceitar cert INCRA)
   ├─ Download com timeout (5 minutos)
   ├─ Salvar ZIP em: /data/sigef/PR/
   └─ Tamanho típico: 5-50 MB

3. EXTRAÇÃO
   ├─ Descompactar ZIP
   ├─ Buscar arquivo .shp recursivamente
   └─ Encontrar arquivos auxiliares (.dbf, .shx, .prj)

4. IMPORTAÇÃO
   ├─ Ler shapefile feature por feature
   ├─ Para cada parcela:
   │  ├─ Extrair propriedades (cod_parcela, proprietario, etc)
   │  ├─ Converter geometria GeoJSON → WKT
   │  ├─ Transformar SRID para EPSG:31982
   │  └─ UPSERT no banco (ON CONFLICT)
   └─ Log a cada 100 registros

5. FINALIZAÇÃO
   ├─ Atualizar sigef_downloads
   ├─ Status: "concluido"
   ├─ Total de registros importados
   └─ Limpar arquivos temporários
```

#### 3. Estrutura de Dados no Banco

**Tabela: sigef_downloads**
```sql
id                | SERIAL PRIMARY KEY
estado            | VARCHAR(2)           -- 'PR', 'SC', etc
tipo              | VARCHAR(50)          -- 'certificada_particular'
data_download     | TIMESTAMP
status            | VARCHAR(20)          -- 'processando', 'concluido', 'erro'
arquivo_nome      | VARCHAR(255)
arquivo_tamanho   | BIGINT
total_registros   | INTEGER
erro_mensagem     | TEXT

UNIQUE(estado, tipo) -- Apenas 1 download por estado
```

**Tabela: sigef_parcelas**
```sql
id                    | SERIAL PRIMARY KEY
download_id           | INTEGER → sigef_downloads(id)
codigo_parcela        | VARCHAR(50) UNIQUE
cod_imovel            | VARCHAR(50)
numero_certificacao   | VARCHAR(50)
situacao_parcela      | VARCHAR(50)
tipo_parcela          | VARCHAR(50)      -- 'particular' ou 'publico'
estado                | VARCHAR(2)
municipio             | VARCHAR(100)
area_hectares         | DECIMAL(15,4)
matricula             | VARCHAR(100)
proprietario          | VARCHAR(500)
cpf_cnpj              | VARCHAR(18)
rt_nome               | VARCHAR(255)     -- Responsável Técnico
rt_registro           | VARCHAR(50)
geometry              | GEOMETRY(Polygon, 31982)  -- SIRGAS2000 UTM 22S
created_at            | TIMESTAMP
updated_at            | TIMESTAMP
```

#### 4. UPSERT e Substituição de Downloads

**Problema Original:** Downloads se acumulavam
**Solução Implementada:** UPSERT pattern

```javascript
INSERT INTO sigef_downloads (estado, tipo, status, data_download)
VALUES ('PR', 'certificada_particular', 'processando', NOW())
ON CONFLICT (estado, tipo) DO UPDATE SET
    status = 'processando',
    data_download = CURRENT_TIMESTAMP,
    arquivo_nome = NULL,
    total_registros = NULL
RETURNING id
```

**Resultado:** Apenas 1 download por estado mantido no banco

#### 5. Estatísticas Típicas

| Estado | Parcelas Certificadas | Tamanho ZIP | Tempo Importação |
|--------|----------------------|-------------|------------------|
| PR     | ~15.000              | 25 MB       | 5-8 min          |
| SC     | ~12.000              | 20 MB       | 4-6 min          |
| RS     | ~18.000              | 30 MB       | 8-12 min         |
| SP     | ~20.000              | 35 MB       | 10-15 min        |
| MG     | ~25.000              | 45 MB       | 12-18 min        |

---

## 🔬 MÓDULO ANÁLISE FUNDIÁRIA

### O Que É?

Ferramenta de **análise geoespacial avançada** que compara geometrias de propriedades locais contra a base de dados SIGEF para:

1. Detectar **sobreposições** (conflitos de área)
2. Identificar **confrontantes** (vizinhos)
3. Calcular **score de viabilidade** (0-100)
4. Gerar **recomendações** técnicas

### Interface Visual

```
┌─────────────────────────────────────────────────────────────┐
│ ANÁLISE FUNDIÁRIA                                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  SIDEBAR (400px)           │  MAPA INTERATIVO (resto)      │
│                            │                                │
│  1. Seleção Propriedade    │  ┌──────────────────────────┐ │
│     [Dropdown ▼]           │  │                          │ │
│                            │  │   Mapa Leaflet           │ │
│  2. Botão Analisar         │  │   - Propriedade (azul)   │ │
│     [🔍 Executar Análise]  │  │   - SIGEF (verde)        │ │
│                            │  │   - Sobreposições (🔴)   │ │
│  3. Resultados             │  │   - Confrontantes (⚠️)    │ │
│     ┌────────────────┐     │  │                          │ │
│     │ Score: 75/100  │     │  │   Zoom, Pan, Layers     │ │
│     │ Risco: MÉDIO   │     │  │                          │ │
│     └────────────────┘     │  └──────────────────────────┘ │
│                            │                                │
│  4. Detalhes               │  Controles:                    │
│     - Sobreposições: 1     │  - Zoom In/Out                 │
│     - Confrontantes: 3     │  - Fullscreen                  │
│     - Área: 50.000 m²      │  - Layers (toggle)             │
│                            │                                │
└─────────────────────────────────────────────────────────────┘
```

### Algoritmos de Análise

#### 1. Detecção de Sobreposições

**Função PostgreSQL:** `analisar_sobreposicao(propriedade_id)`

```sql
RETURNS TABLE (
    parcela_sigef_id INTEGER,
    codigo_parcela VARCHAR,
    tipo_sobreposicao VARCHAR,  -- 'total', 'parcial', 'adjacente'
    area_sobreposicao_m2 DECIMAL,
    percentual_propriedade DECIMAL,
    percentual_parcela DECIMAL,
    proprietario_sigef VARCHAR,
    matricula_sigef VARCHAR
)
```

**Tipos de Sobreposição:**

```
1. TOTAL_PROPRIEDADE_DENTRO
   ┌─────────────────┐
   │  SIGEF          │
   │   ┌─────┐       │   Propriedade completamente
   │   │ Prop│       │   dentro da parcela SIGEF
   │   └─────┘       │
   └─────────────────┘

2. TOTAL_PARCELA_DENTRO
   ┌─────────────────┐
   │  Propriedade    │
   │   ┌─────┐       │   Parcela SIGEF completamente
   │   │SIGEF│       │   dentro da propriedade
   │   └─────┘       │
   └─────────────────┘

3. PARCIAL
   ┌─────────┐
   │  Prop   │
   │    ┌────┼────┐   Sobreposição parcial
   │    │ ██ │    │   (área comum)
   └────┼────┘    │
        │  SIGEF  │
        └─────────┘

4. ADJACENTE
   ┌─────────┐┌─────────┐
   │  Prop   ││  SIGEF  │  Fazem divisa mas
   │         ││         │  não sobrepõem
   └─────────┘└─────────┘
```

**Operações PostGIS Utilizadas:**

```sql
-- Verificar se propriedade está dentro de parcela SIGEF
ST_Contains(sp.geometry, p.geometry)

-- Verificar se parcela SIGEF está dentro da propriedade
ST_Contains(p.geometry, sp.geometry)

-- Verificar sobreposição parcial
ST_Overlaps(p.geometry, sp.geometry)

-- Verificar adjacência (divisa)
ST_Touches(p.geometry, sp.geometry)

-- Calcular área de interseção
ST_Area(ST_Intersection(p.geometry, sp.geometry))

-- Calcular percentual
(area_intersecao / area_total) * 100
```

#### 2. Identificação de Confrontantes

**Função PostgreSQL:** `identificar_confrontantes(propriedade_id, raio_metros)`

```sql
RETURNS TABLE (
    parcela_sigef_id INTEGER,
    codigo_parcela VARCHAR,
    tipo_contato VARCHAR,        -- 'limite_comum' ou 'proximo'
    distancia_m DECIMAL,
    comprimento_contato_m DECIMAL,  -- Para limites comuns
    azimute DECIMAL,             -- Direção em graus (0-360)
    proprietario VARCHAR,
    area_ha DECIMAL
)
```

**Classificação de Confrontantes:**

```
1. LIMITE_COMUM (ST_Touches)
   ┌─────────┬─────────┐
   │  Prop   │  SIGEF  │   Compartilham divisa
   │         │         │   Distância = 0 m
   └─────────┴─────────┘   Comprimento medido

2. PRÓXIMO (raio padrão: 100m)
   ┌─────────┐  50m  ┌─────────┐
   │  Prop   │ <----> │  SIGEF  │  Próximos mas
   │         │        │         │  sem divisa
   └─────────┘        └─────────┘

3. DISTANTE (fora do raio)
   ┌─────────┐       200m      ┌─────────┐
   │  Prop   │ <-------------> │  SIGEF  │  Ignorado
   │         │                 │         │  (muito longe)
   └─────────┘                 └─────────┘
```

**Cálculo de Azimute:**

```
Azimute = direção em graus (0-360°)

        0° (Norte)
            ↑
            │
270° ←──────┼──────→ 90° (Leste)
   (Oeste)  │
            ↓
        180° (Sul)

ST_Azimuth(centroid_propriedade, centroid_parcela)
```

**Comprimento de Divisa Compartilhada:**

```sql
ST_Length(
    ST_Intersection(
        ST_Boundary(propriedade),
        ST_Boundary(parcela_sigef)
    )
)
```

#### 3. Cálculo de Score de Viabilidade

**Função PostgreSQL:** `calcular_score_viabilidade(propriedade_id)`

```sql
RETURNS TABLE (
    score_total INTEGER,           -- 0-100
    nivel_risco VARCHAR,           -- BAIXO, MÉDIO, ALTO, CRÍTICO
    tem_sobreposicao BOOLEAN,
    qtd_sobreposicoes INTEGER,
    area_sobreposta_m2 DECIMAL,
    qtd_confrontantes INTEGER,
    recomendacao TEXT
)
```

**Algoritmo de Pontuação:**

```javascript
SCORE INICIAL = 100 pontos

PENALIDADES:

1. Por Sobreposição:
   - Cada sobreposição: -30 pontos
   - Múltiplas (>2): -20 pontos adicionais

   Exemplo:
   - 1 sobreposição: 100 - 30 = 70 pontos
   - 2 sobreposições: 100 - 60 = 40 pontos
   - 3 sobreposições: 100 - 90 - 20 = -10 → 0 pontos (mínimo)

2. Por Complexidade (Confrontantes):
   - Mais de 10 confrontantes: -15 pontos
   - Entre 5 e 10 confrontantes: -5 pontos
   - Menos de 5: sem penalidade

   Razão: Muitos confrontantes = levantamento mais complexo

CLASSIFICAÇÃO:

score >= 80  →  RISCO BAIXO
score >= 50  →  RISCO MÉDIO
score >= 30  →  RISCO ALTO
score < 30   →  RISCO CRÍTICO
```

**Tabela de Interpretação:**

| Score | Nível   | Significado | Recomendação |
|-------|---------|-------------|--------------|
| 80-100 | BAIXO   | 🟢 Viável   | "Trabalho viável. Poucas ou nenhuma complicação esperada." |
| 50-79  | MÉDIO   | 🟡 Atenção  | "Requer atenção. Verificar sobreposições e confrontantes detalhadamente." |
| 30-49  | ALTO    | 🟠 Complexo | "Trabalho complexo. Sobreposições detectadas. Análise jurídica recomendada." |
| 0-29   | CRÍTICO | 🔴 Risco    | "Múltiplas sobreposições. Avaliar viabilidade antes de aceitar o trabalho." |

---

## 🔗 INTEGRAÇÃO SIGEF + ANÁLISE FUNDIÁRIA

### Como as Ferramentas Se Complementam?

```
┌────────────────────────────────────────────────────────────┐
│                   FLUXO INTEGRADO                          │
└────────────────────────────────────────────────────────────┘

ETAPA 1: PREPARAÇÃO DA BASE DE DADOS
├─ Download SIGEF para estados relevantes (PR, SC, RS...)
├─ Importação de ~15.000 parcelas certificadas por estado
└─ Base de dados geoespacial completa no PostgreSQL

        ↓ (Base SIGEF pronta)

ETAPA 2: CADASTRO DE PROPRIEDADES
├─ Cliente solicita levantamento topográfico
├─ Topógrafo importa memorial descritivo (DOCX)
├─ Sistema gera polígono da propriedade
├─ Geometria armazenada em EPSG:31982
└─ Propriedade cadastrada no banco

        ↓ (Propriedade + SIGEF no mesmo banco)

ETAPA 3: ANÁLISE AUTOMÁTICA
├─ Topógrafo acessa "Análise Fundiária"
├─ Seleciona propriedade do cliente
├─ Sistema executa 3 análises em paralelo:
│  ├─ 1. Detectar sobreposições (ST_Intersects)
│  ├─ 2. Identificar confrontantes (ST_DWithin)
│  └─ 3. Calcular score de viabilidade
└─ Resultados exibidos em <5 segundos

        ↓ (Análise completa disponível)

ETAPA 4: VISUALIZAÇÃO E DECISÃO
├─ Mapa interativo mostra:
│  ├─ Propriedade (polígono azul)
│  ├─ Parcelas SIGEF (verdes)
│  ├─ Sobreposições (vermelhas) 🔴
│  └─ Confrontantes (amarelos) ⚠️
├─ Painel lateral com score e detalhes
├─ Topógrafo analisa complexidade
└─ DECISÃO: Aceitar ou recusar trabalho

        ↓ (Decisão informada)

ETAPA 5: DOCUMENTAÇÃO
├─ Sistema salva análise no histórico
├─ Tabela: sigef_sobreposicoes
├─ Tabela: sigef_confrontantes
└─ Rastreabilidade completa
```

### Tabelas de Persistência

**sigef_sobreposicoes**
```sql
id                       | SERIAL PRIMARY KEY
propriedade_local_id     | INTEGER → propriedades(id)
parcela_sigef_id         | INTEGER → sigef_parcelas(id)
tipo_sobreposicao        | VARCHAR(50)  -- 'total', 'parcial', etc
area_sobreposicao_m2     | DECIMAL(15,2)
percentual_sobreposicao  | DECIMAL(5,2)
geometry_intersecao      | GEOMETRY(Polygon, 31982)
analisado_em             | TIMESTAMP
status                   | VARCHAR(20)  -- 'pendente', 'resolvido'
observacoes              | TEXT

-- Histórico completo de todas as análises realizadas
```

**sigef_confrontantes**
```sql
id                       | SERIAL PRIMARY KEY
parcela_id               | INTEGER → propriedades(id)
parcela_vizinha_id       | INTEGER → sigef_parcelas(id)
tipo_contato             | VARCHAR(50)  -- 'limite_comum', 'proximo'
distancia_m              | DECIMAL(10,2)
comprimento_contato_m    | DECIMAL(10,2)
azimute                  | DECIMAL(10,6)
created_at               | TIMESTAMP

-- Lista de todos os confrontantes identificados
```

---

## 🔄 FLUXO DE TRABALHO COMPLETO

### Cenário Real: Novo Cliente Solicita Levantamento

```
DIA 1: PREPARAÇÃO
─────────────────────────────────────────────────────

09:00 - Cliente liga: "Preciso de levantamento topográfico"
09:15 - Topógrafo acessa sistema COGEP
09:20 - Download SIGEF PR (se ainda não tiver)
        Status: "Processando..."
09:25 - Aguarda importação (5-8 minutos)
09:33 - ✅ 15.243 parcelas SIGEF importadas


DIA 2: CADASTRO E ANÁLISE PRÉVIA
─────────────────────────────────────────────────────

10:00 - Cliente envia memorial descritivo (.docx)
10:05 - Topógrafo importa memorial no sistema
        ├─ Sistema extrai vértices
        ├─ Gera polígono automaticamente
        ├─ Calcula área e perímetro
        └─ Salva no banco de dados

10:10 - Topógrafo acessa "Análise Fundiária"
10:11 - Seleciona propriedade recém-cadastrada
10:12 - Clica em "🔍 Executar Análise"

10:12 - Sistema processa:
        ├─ Verificando sobreposições...  (2s)
        ├─ Identificando confrontantes... (2s)
        └─ Calculando score...           (1s)

10:12 - RESULTADO EXIBIDO:
        ┌───────────────────────────────┐
        │ SCORE: 65/100                 │
        │ RISCO: MÉDIO 🟡               │
        ├───────────────────────────────┤
        │ ✅ Sem sobreposições          │
        │ ⚠️  4 confrontantes           │
        │ 📏 Área: 50.450 m²            │
        └───────────────────────────────┘

10:13 - Topógrafo analisa mapa:
        - Propriedade em azul (centro)
        - 4 parcelas SIGEF vizinhas (verde)
        - Todas fazem divisa comum
        - Nenhuma sobreposição vermelha

10:15 - DECISÃO: "Aceito o trabalho!"
        - Risco médio aceitável
        - Confrontantes conhecidos
        - Nenhum conflito fundiário


DIA 3: ORÇAMENTO E CONTRATO
─────────────────────────────────────────────────────

14:00 - Topógrafo prepara orçamento:
        ├─ Conhece área exata: 50.450 m²
        ├─ Sabe que há 4 confrontantes
        ├─ Prevê complexidade média
        └─ Orçamento ajustado

14:30 - Cliente aprova orçamento
14:45 - Contrato assinado


SEMANA 1: TRABALHO DE CAMPO
─────────────────────────────────────────────────────

Topógrafo vai a campo sabendo:
✅ Área esperada: 50.450 m²
✅ Quantidade de confrontantes: 4
✅ Nomes dos proprietários vizinhos (SIGEF)
✅ Sem conflitos fundiários esperados

Resultado: Levantamento tranquilo, sem surpresas


SEMANA 2: FINALIZAÇÃO
─────────────────────────────────────────────────────

- Dados processados
- Memorial sintético gerado
- Cliente satisfeito
- Trabalho entregue no prazo
```

### Cenário Alternativo: Propriedade com Sobreposição

```
ANÁLISE PRÉVIA DETECTA PROBLEMA
─────────────────────────────────────────────────────

10:12 - RESULTADO CRÍTICO:
        ┌───────────────────────────────┐
        │ SCORE: 25/100                 │
        │ RISCO: CRÍTICO 🔴             │
        ├───────────────────────────────┤
        │ ⚠️  2 sobreposições!          │
        │ 📏 Área sobreposta: 8.500 m²  │
        │ 👥 6 confrontantes            │
        └───────────────────────────────┘

10:13 - Topógrafo vê no mapa:
        - Propriedade do cliente (azul)
        - 2 polígonos SIGEF vermelhos sobrepondo
        - Dados dos proprietários SIGEF visíveis

10:15 - Topógrafo clica em sobreposição:
        Popup mostra:
        ├─ Proprietário SIGEF: "João da Silva"
        ├─ Matrícula: 12.345
        ├─ Área sobreposta: 8.500 m² (17% da propriedade)
        ├─ CPF: ***.***.***-**
        └─ Certificado INCRA: 2023

10:20 - DECISÃO: "Recuso o trabalho"
        Motivos:
        - Conflito fundiário detectado
        - 17% da área está sobreposta
        - Risco jurídico alto
        - Trabalho pode ser contestado

10:25 - Topógrafo liga para cliente:
        "Detectamos sobreposição com parcela certificada
         no INCRA. Recomendo regularizar situação jurídica
         antes do levantamento topográfico."

RESULTADO: Cliente agradece a análise prévia,
           evita custos com trabalho que seria contestado
```

---

## 💼 CASOS DE USO PRÁTICOS

### Caso 1: Fazenda Rural com Múltiplos Confrontantes

**Situação:**
- Fazenda de 250 hectares
- 12 confrontantes identificados
- Nenhuma sobreposição

**Análise:**
```
Score: 65/100 (MÉDIO)
Penalidades:
- 0 pontos (sem sobreposição)
- -15 pontos (mais de 10 confrontantes)
- -20 pontos (complexidade alta)

Resultado: 100 - 15 - 20 = 65
```

**Interpretação:**
- ✅ Trabalho viável
- ⚠️  Levantamento complexo devido à quantidade de divisas
- 💡 Orçamento deve considerar tempo extra para marcos
- 📋 Lista de 12 confrontantes conhecidos previamente

**Ação:** Aceitar trabalho com orçamento ajustado

---

### Caso 2: Lote Urbano Sem Conflitos

**Situação:**
- Lote urbano de 500 m²
- 2 confrontantes (lotes vizinhos)
- Sem sobreposições

**Análise:**
```
Score: 100/100 (BAIXO)
Penalidades:
- 0 pontos (sem sobreposição)
- 0 pontos (poucos confrontantes)

Resultado: 100
```

**Interpretação:**
- ✅✅ Trabalho ideal
- ✅ Baixíssima complexidade
- ✅ Sem riscos identificados
- 💰 Orçamento padrão

**Ação:** Aceitar trabalho imediatamente

---

### Caso 3: Propriedade com Sobreposição Parcial

**Situação:**
- Sítio de 10 hectares
- 1 sobreposição parcial de 2.000 m² (2%)
- 3 confrontantes

**Análise:**
```
Score: 70/100 (MÉDIO)
Penalidades:
- -30 pontos (1 sobreposição)
- 0 pontos (poucos confrontantes)

Resultado: 100 - 30 = 70
```

**Interpretação:**
- ⚠️  Atenção necessária
- 🔍 Verificar se sobreposição é erro de GPS ou real
- 📞 Contatar proprietário da parcela SIGEF
- ⚖️  Pode requerer análise jurídica

**Informações do Sistema:**
```
Sobreposição com:
├─ Proprietário: Maria dos Santos
├─ Matrícula SIGEF: 67.890
├─ Área sobreposta: 2.000 m² (2% da propriedade)
├─ Tipo: PARCIAL
└─ CPF: 123.456.789-00
```

**Ação:** Aceitar com ressalvas, investigar sobreposição

---

### Caso 4: Propriedade Totalmente Sobreposta

**Situação:**
- Propriedade de 5 hectares
- 1 sobreposição TOTAL (100%)
- Cliente não sabia do problema

**Análise:**
```
Score: 0/100 (CRÍTICO)
Penalidades:
- -30 pontos (sobreposição)
- -70 pontos extras (sobreposição total)

Resultado: 100 - 30 - 70 = 0
```

**Interpretação:**
- 🔴 TRABALHO INVIÁVEL
- ⚠️  Toda a área está certificada em nome de terceiro
- ⚖️  Problema jurídico grave
- 🚫 Levantamento seria contestado

**Informações do Sistema:**
```
ALERTA CRÍTICO:
├─ Propriedade 100% dentro de parcela SIGEF
├─ Proprietário SIGEF: Empresa XYZ Ltda
├─ Matrícula SIGEF: 12.345
├─ Certificado INCRA: 2020
├─ Situação: Regular
└─ ⚠️  CONFLITO GRAVE!
```

**Ação:** RECUSAR trabalho, orientar cliente a buscar advogado

---

## 📊 ALGORITMOS E CÁLCULOS DETALHADOS

### Cálculo de Área de Interseção

```sql
-- PostGIS calcula área da geometria comum entre duas geometrias
ST_Area(ST_Intersection(propriedade.geometry, sigef.geometry))

Exemplo:
Propriedade: 50.000 m²
SIGEF:       80.000 m²
Interseção:   8.000 m²

Percentual da propriedade: (8.000 / 50.000) * 100 = 16%
Percentual da SIGEF:       (8.000 / 80.000) * 100 = 10%
```

### Cálculo de Distância

```sql
-- PostGIS calcula menor distância entre duas geometrias
ST_Distance(propriedade.geometry, sigef.geometry)

Resultado em metros (EPSG:31982 é projetado)

Confrontante direto:  ST_Touches = true  → distancia = 0 m
Próximo (100m):       ST_DWithin = true  → distancia < 100 m
Distante:             ST_DWithin = false → distancia >= 100 m
```

### Cálculo de Azimute

```sql
-- PostGIS calcula ângulo do Norte (0°) até o ponto
ST_Azimuth(centroid_origem, centroid_destino)

Retorna: radianos
Conversão: degrees(radianos) = graus

Exemplo:
Propriedade centro: -51.5, -25.5
SIGEF centro:       -51.4, -25.5

Azimute ≈ 90° (Leste)
```

### Algoritmo de Score Completo

```python
def calcular_score_viabilidade(propriedade_id):
    # INICIALIZAÇÃO
    score = 100

    # 1. ANÁLISE DE SOBREPOSIÇÕES
    sobreposicoes = buscar_sobreposicoes(propriedade_id)
    qtd_sobreposicoes = len(sobreposicoes)

    if qtd_sobreposicoes > 0:
        score -= qtd_sobreposicoes * 30

        # Penalidade extra para múltiplas
        if qtd_sobreposicoes > 2:
            score -= 20

    # 2. ANÁLISE DE CONFRONTANTES
    confrontantes = buscar_confrontantes(propriedade_id)
    qtd_confrontantes = len(confrontantes)

    if qtd_confrontantes > 10:
        score -= 15  # Muitos confrontantes = complexo
    elif qtd_confrontantes > 5:
        score -= 5

    # 3. GARANTIR MÍNIMO
    if score < 0:
        score = 0

    # 4. CLASSIFICAR RISCO
    if score >= 80:
        nivel = 'BAIXO'
        recomendacao = 'Viável. Poucas complicações.'
    elif score >= 50:
        nivel = 'MÉDIO'
        recomendacao = 'Requer atenção. Verificar detalhes.'
    elif score >= 30:
        nivel = 'ALTO'
        recomendacao = 'Complexo. Análise jurídica recomendada.'
    else:
        nivel = 'CRÍTICO'
        recomendacao = 'Múltiplas sobreposições. Avaliar viabilidade.'

    return {
        'score': score,
        'nivel': nivel,
        'recomendacao': recomendacao,
        'sobreposicoes': sobreposicoes,
        'confrontantes': confrontantes
    }
```

---

## 📈 RESULTADOS E INTERPRETAÇÃO

### Dashboard de Resultados

```
┌────────────────────────────────────────────────────┐
│ RESULTADO DA ANÁLISE FUNDIÁRIA                     │
├────────────────────────────────────────────────────┤
│                                                    │
│  ┌──────────────────────────────────────────┐     │
│  │  SCORE DE VIABILIDADE                    │     │
│  │                                          │     │
│  │  ████████████████░░░░  75 / 100         │     │
│  │                                          │     │
│  │  Nível de Risco: MÉDIO 🟡               │     │
│  └──────────────────────────────────────────┘     │
│                                                    │
│  DETALHES:                                         │
│  ├─ Sobreposições: ⚠️  1 detectada                │
│  │  └─ Área: 2.500 m² (5% da propriedade)        │
│  │                                                │
│  ├─ Confrontantes: 👥 4 identificados             │
│  │  ├─ 3 com limite comum                        │
│  │  └─ 1 próximo (85m)                           │
│  │                                                │
│  ├─ Área da Propriedade: 50.450 m²               │
│  ├─ Perímetro: 912 m                              │
│  └─ Município: Campo Largo - PR                   │
│                                                    │
│  RECOMENDAÇÃO:                                     │
│  "Trabalho requer atenção. Verificar sobreposição │
│   detectada com proprietário. Confrontantes       │
│   conhecidos facilitam levantamento."             │
│                                                    │
│  [📄 Exportar Relatório PDF]                      │
│  [📧 Enviar para Cliente]                         │
│  [✅ Aceitar Trabalho]    [❌ Recusar]            │
└────────────────────────────────────────────────────┘
```

### Tabela de Sobreposições

```
┌──────────────────────────────────────────────────────────────────┐
│ SOBREPOSIÇÕES DETECTADAS (1)                                    │
├──────────────────────────────────────────────────────────────────┤
│ Cód. Parcela │ Proprietário       │ Tipo     │ Área    │ %     │
├──────────────┼───────────────────┼──────────┼─────────┼───────┤
│ PR-12345     │ Maria dos Santos  │ PARCIAL  │ 2.500m² │ 5%    │
│              │ CPF: 123.456      │          │         │       │
│              │ Mat: 67.890       │          │         │       │
│              │ [🔍 Ver no Mapa]  │          │         │       │
└──────────────┴───────────────────┴──────────┴─────────┴───────┘
```

### Tabela de Confrontantes

```
┌────────────────────────────────────────────────────────────────────┐
│ CONFRONTANTES IDENTIFICADOS (4)                                    │
├────────────────────────────────────────────────────────────────────┤
│ Cód. Parcela │ Proprietário       │ Contato       │ Dist. │ Azim. │
├──────────────┼───────────────────┼───────────────┼───────┼───────┤
│ PR-11111     │ João Silva        │ Limite comum  │ 0 m   │ 45°   │
│              │ Área: 25 ha       │ (235m divisa) │       │ (NE)  │
│              │ [🔍 Ver no Mapa]  │               │       │       │
├──────────────┼───────────────────┼───────────────┼───────┼───────┤
│ PR-22222     │ Empresa XYZ Ltda  │ Limite comum  │ 0 m   │ 135°  │
│              │ Área: 50 ha       │ (180m divisa) │       │ (SE)  │
│              │ [🔍 Ver no Mapa]  │               │       │       │
├──────────────┼───────────────────┼───────────────┼───────┼───────┤
│ PR-33333     │ Pedro Costa       │ Limite comum  │ 0 m   │ 225°  │
│              │ Área: 15 ha       │ (150m divisa) │       │ (SO)  │
│              │ [🔍 Ver no Mapa]  │               │       │       │
├──────────────┼───────────────────┼───────────────┼───────┼───────┤
│ PR-44444     │ Fazenda ABC       │ Próximo       │ 85 m  │ 315°  │
│              │ Área: 100 ha      │               │       │ (NO)  │
│              │ [🔍 Ver no Mapa]  │               │       │       │
└──────────────┴───────────────────┴───────────────┴───────┴───────┘
```

### Visualização no Mapa

```
LEGENDA:
─────────
🔵 Azul      = Propriedade do cliente
🟢 Verde     = Parcelas SIGEF (sem conflito)
🔴 Vermelho  = Sobreposições detectadas
🟡 Amarelo   = Confrontantes (limite comum)
🟠 Laranja   = Confrontantes (próximos)

INTERAÇÕES:
───────────
- Clique em polígono → Popup com detalhes
- Zoom para área de interesse
- Toggle layers (ligar/desligar camadas)
- Fullscreen para apresentar ao cliente
```

---

## 🎓 CONCLUSÃO

### O Que Este Sistema Oferece?

**ANTES (sem o sistema):**
- ❌ Topógrafo aceita trabalho sem conhecer riscos
- ❌ Descobre sobreposição no meio do levantamento
- ❌ Cliente reclama de custos extras
- ❌ Trabalho pode ser contestado judicialmente
- ❌ Desconhece quantidade de confrontantes

**DEPOIS (com o sistema):**
- ✅ Análise prévia em menos de 5 segundos
- ✅ Sobreposições detectadas antes de aceitar
- ✅ Score de viabilidade automático (0-100)
- ✅ Confrontantes conhecidos previamente
- ✅ Decisão informada: aceitar ou recusar
- ✅ Orçamento preciso considerando complexidade
- ✅ Cliente recebe análise profissional
- ✅ Rastreabilidade e documentação completa

### Valor para o Negócio

**Redução de Risco:**
- Evita aceitar trabalhos com conflitos fundiários
- Protege reputação profissional
- Reduz chance de processos judiciais

**Aumento de Eficiência:**
- Análise automatizada vs. horas de pesquisa manual
- Conhecimento prévio de confrontantes
- Orçamento mais preciso

**Diferencial Competitivo:**
- Ferramenta profissional de análise
- Relatórios técnicos para clientes
- Decisões baseadas em dados reais (INCRA)

---

**Documentação gerada automaticamente**
**Sistema de Gerenciamento de Marcos Geodésicos FHV**
**Versão: 2.0**
**Data: 05/11/2025**
