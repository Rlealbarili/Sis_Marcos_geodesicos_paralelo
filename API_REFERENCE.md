# 📡 API REFERENCE - SISTEMA DE MARCOS GEODÉSICOS

**Versão:** 1.0  
**Base URL:** `http://localhost:3000/api`  
**Formato:** JSON  
**Autenticação:** Nenhuma (v1.0)

---

## 📑 ÍNDICE

1. [Visão Geral](#visão-geral)
2. [Endpoints](#endpoints)
3. [Modelos de Dados](#modelos-de-dados)
4. [Códigos de Status](#códigos-de-status)
5. [Exemplos de Uso](#exemplos-de-uso)
6. [Limitações](#limitações)

---

## 1. VISÃO GERAL

### Características

- ✅ REST API
- ✅ Respostas em JSON
- ✅ Suporte a paginação
- ✅ Filtros por query params
- ✅ CORS habilitado

### Headers Padrão

```http
Content-Type: application/json
Access-Control-Allow-Origin: *
```

---

## 2. ENDPOINTS

### 2.1. GET /api/marcos

Retorna lista de marcos geodésicos.

#### Request

```http
GET /api/marcos?limite=100&offset=0&levantados=true
```

**Query Parameters:**

| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `limite` | integer | Não | 1000 | Número máximo de resultados (1-10000) |
| `offset` | integer | Não | 0 | Paginação - índice inicial |
| `levantados` | boolean | Não | false | Se true, retorna apenas marcos com coordenadas |

#### Response

**Status:** `200 OK`

```json
{
  "data": [
    {
      "id": 1,
      "codigo": "FHV-M-0001",
      "tipo": "M",
      "municipio": "Londrina",
      "estado": "PR",
      "coordenada_e": 650589.8882,
      "coordenada_n": 7192069.4339,
      "altitude": 610.5,
      "latitude": -25.42456931689032,
      "longitude": -49.61581130234676,
      "data_levantamento": "2024-03-15",
      "metodo": "RTK",
      "precisao_horizontal": 0.02,
      "precisao_vertical": 0.03,
      "observacoes": "Marco em bom estado",
      "status": "LEVANTADO",
      "criado_em": "2025-10-20T14:23:50.000Z",
      "atualizado_em": "2025-10-20T14:23:50.000Z"
    }
  ],
  "total": 218,
  "levantados": 218,
  "pendentes": 0
}
```

---

### 2.2. GET /api/marcos/:codigo

Retorna um marco específico por código.

#### Request

```http
GET /api/marcos/FHV-M-0001
```

**Path Parameters:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `codigo` | string | Sim | Código único do marco |

#### Response

**Status:** `200 OK`

```json
{
  "id": 1,
  "codigo": "FHV-M-0001",
  "tipo": "M",
  "municipio": "Londrina",
  "estado": "PR",
  "coordenada_e": 650589.8882,
  "coordenada_n": 7192069.4339,
  "altitude": 610.5,
  "latitude": -25.42456931689032,
  "longitude": -49.61581130234676,
  "data_levantamento": "2024-03-15",
  "metodo": "RTK",
  "precisao_horizontal": 0.02,
  "precisao_vertical": 0.03,
  "observacoes": "Marco em bom estado",
  "status": "LEVANTADO",
  "criado_em": "2025-10-20T14:23:50.000Z",
  "atualizado_em": "2025-10-20T14:23:50.000Z"
}
```

**Status:** `404 Not Found`

```json
{
  "error": "Marco não encontrado"
}
```

---

### 2.3. GET /api/marcos/buscar

Busca marcos por filtros.

#### Request

```http
GET /api/marcos/buscar?tipo=M&municipio=Londrina&status=LEVANTADO
```

**Query Parameters:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `tipo` | string | Não | Tipo do marco (V, M ou P) |
| `municipio` | string | Não | Nome do município |
| `estado` | string | Não | Sigla do estado (PR, SC, RS, etc) |
| `status` | string | Não | Status (LEVANTADO ou PENDENTE) |

#### Response

**Status:** `200 OK`

```json
{
  "data": [
    {
      "id": 1,
      "codigo": "FHV-M-0001",
      "tipo": "M",
      "municipio": "Londrina",
      ...
    }
  ],
  "total": 45
}
```

---

### 2.4. GET /api/estatisticas

Retorna estatísticas gerais do sistema.

#### Request

```http
GET /api/estatisticas
```

#### Response

**Status:** `200 OK`

```json
{
  "total_marcos": 19041,
  "marcos_levantados": 218,
  "marcos_pendentes": 18823,
  "por_tipo": {
    "V": 3313,
    "M": 6927,
    "P": 8801
  },
  "por_estado": {
    "PR": 19041
  },
  "com_coordenadas": 218,
  "sem_coordenadas": 18823,
  "percentual_levantados": 1.1
}
```

---

### 2.5. GET /api/marcos/exportar

Exporta todos os marcos para Excel.

#### Request

```http
GET /api/marcos/exportar
```

#### Response

**Status:** `200 OK`  
**Content-Type:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`  
**Content-Disposition:** `attachment; filename="marcos_geodesicos_20251020.xlsx"`

Retorna arquivo Excel binário para download.

---

### 2.6. POST /api/marcos/importar

Importa marcos de arquivo Excel.

#### Request

```http
POST /api/marcos/importar
Content-Type: multipart/form-data
```

**Body:**
```
arquivo: [FILE] (Excel .xlsx)
```

#### Response

**Status:** `200 OK`

```json
{
  "sucesso": true,
  "processados": 1000,
  "inseridos": 950,
  "atualizados": 50,
  "erros": 0,
  "mensagem": "Importação concluída com sucesso"
}
```

**Status:** `400 Bad Request`

```json
{
  "error": "Formato de arquivo inválido",
  "detalhes": "Apenas arquivos .xlsx são aceitos"
}
```

---

## 3. MODELOS DE DADOS

### Marco Levantado

```typescript
interface MarcoLevantado {
  id: number;
  codigo: string;              // Ex: "FHV-M-0001"
  tipo: "V" | "M" | "P";       // Vértice, Marco ou Ponto
  municipio: string | null;
  estado: string;              // Default: "PR"
  
  // Coordenadas UTM (EPSG:31982)
  coordenada_e: number | null; // East/X em metros
  coordenada_n: number | null; // North/Y em metros
  altitude: number | null;     // Metros
  
  // Coordenadas Geográficas (EPSG:4326)
  latitude: number | null;     // Graus decimais
  longitude: number | null;    // Graus decimais
  
  // Metadados
  data_levantamento: string | null;  // ISO 8601
  metodo: string | null;             // Ex: "RTK", "PPP"
  precisao_horizontal: number | null; // Metros
  precisao_vertical: number | null;   // Metros
  observacoes: string | null;
  status: string;                     // Default: "LEVANTADO"
  
  // Auditoria
  criado_em: string;           // ISO 8601
  atualizado_em: string;       // ISO 8601
}
```

### Marco Pendente

```typescript
interface MarcoPendente {
  id: number;
  codigo: string;
  tipo: "V" | "M" | "P";
  municipio: string | null;
  estado: string;
  observacoes: string | null;
  criado_em: string;
}
```

### Estatísticas

```typescript
interface Estatisticas {
  total_marcos: number;
  marcos_levantados: number;
  marcos_pendentes: number;
  por_tipo: {
    V: number;
    M: number;
    P: number;
  };
  por_estado: {
    [estado: string]: number;
  };
  com_coordenadas: number;
  sem_coordenadas: number;
  percentual_levantados: number;
}
```

---

## 4. CÓDIGOS DE STATUS

| Código | Descrição | Quando usar |
|--------|-----------|-------------|
| `200 OK` | Sucesso | Requisição processada com sucesso |
| `201 Created` | Criado | Novo recurso criado |
| `400 Bad Request` | Requisição inválida | Parâmetros incorretos ou faltando |
| `404 Not Found` | Não encontrado | Recurso solicitado não existe |
| `500 Internal Server Error` | Erro do servidor | Erro interno não tratado |

---

## 5. EXEMPLOS DE USO

### JavaScript (Fetch API)

#### Buscar todos os marcos levantados

```javascript
fetch('http://localhost:3000/api/marcos?levantados=true&limite=1000')
  .then(response => response.json())
  .then(data => {
    console.log(`Total de marcos: ${data.total}`);
    data.data.forEach(marco => {
      console.log(`${marco.codigo}: ${marco.latitude}, ${marco.longitude}`);
    });
  })
  .catch(error => console.error('Erro:', error));
```

#### Buscar marco específico

```javascript
const codigo = 'FHV-M-0001';

fetch(`http://localhost:3000/api/marcos/${codigo}`)
  .then(response => {
    if (!response.ok) {
      throw new Error('Marco não encontrado');
    }
    return response.json();
  })
  .then(marco => {
    console.log('Marco encontrado:', marco);
  })
  .catch(error => console.error('Erro:', error));
```

#### Buscar com filtros

```javascript
const params = new URLSearchParams({
  tipo: 'M',
  municipio: 'Londrina',
  status: 'LEVANTADO'
});

fetch(`http://localhost:3000/api/marcos/buscar?${params}`)
  .then(response => response.json())
  .then(data => {
    console.log(`Encontrados ${data.total} marcos`);
  });
```

#### Obter estatísticas

```javascript
fetch('http://localhost:3000/api/marcos/estatisticas')
  .then(response => response.json())
  .then(stats => {
    console.log('Estatísticas do sistema:');
    console.table(stats);
  });
```

### cURL

#### Buscar marcos

```bash
curl -X GET "http://localhost:3000/api/marcos?limite=10&levantados=true"
```

#### Buscar marco específico

```bash
curl -X GET "http://localhost:3000/api/marcos/FHV-M-0001"
```

#### Obter estatísticas

```bash
curl -X GET "http://localhost:3000/api/marcos/estatisticas"
```

#### Exportar para Excel

```bash
curl -X GET "http://localhost:3000/api/marcos/exportar" \
  -o marcos_export.xlsx
```

### Python (requests)

```python
import requests

# Configuração
BASE_URL = "http://localhost:3000/api"

# Buscar marcos levantados
response = requests.get(f"{BASE_URL}/marcos", params={
    "levantados": "true",
    "limite": 1000
})

if response.status_code == 200:
    data = response.json()
    print(f"Total de marcos: {data['total']}")
    
    for marco in data['data']:
        print(f"{marco['codigo']}: {marco['latitude']}, {marco['longitude']}")
else:
    print(f"Erro: {response.status_code}")

# Buscar marco específico
codigo = "FHV-M-0001"
response = requests.get(f"{BASE_URL}/marcos/{codigo}")

if response.status_code == 200:
    marco = response.json()
    print(f"Marco encontrado: {marco['codigo']}")
elif response.status_code == 404:
    print("Marco não encontrado")

# Estatísticas
response = requests.get(f"{BASE_URL}/marcos/estatisticas")
stats = response.json()
print(f"Total de marcos: {stats['total_marcos']}")
print(f"Levantados: {stats['marcos_levantados']}")
```

---

## 6. LIMITAÇÕES

### Versão 1.0

- ❌ **Sem autenticação**: Qualquer pessoa pode acessar a API
- ❌ **Sem rate limiting**: Possível abuso com muitas requisições
- ❌ **Sem versionamento**: API pode mudar sem aviso
- ❌ **Sem webhooks**: Não notifica mudanças
- ❌ **Sem GraphQL**: Apenas REST disponível

### Limites Técnicos

| Limite | Valor | Descrição |
|--------|-------|-----------|
| Max registros por requisição | 10.000 | Parâmetro `limite` |
| Max tamanho de arquivo (import) | 50 MB | Upload de Excel |
| Timeout de requisição | 30s | Requisições longas são cortadas |
| Max conexões simultâneas | 100 | Limite do Express |

---

## 📚 RECURSOS ADICIONAIS

### Ferramentas Recomendadas

- **Postman**: Testar API interativamente
- **Insomnia**: Alternativa ao Postman
- **Swagger UI**: Documentação interativa (futuro)

### Próximas Versões

**v1.1 (Planejado):**
- ✨ Autenticação JWT
- ✨ Rate limiting
- ✨ Webhooks
- ✨ Filtros geoespaciais (raio, bbox)

**v2.0 (Futuro):**
- ✨ GraphQL endpoint
- ✨ WebSocket para atualizações em tempo real
- ✨ Versionamento da API (/v2/)
- ✨ Documentação Swagger/OpenAPI

---

**Versão da API:** 1.0  
**Data:** Outubro 2025  
**Contato:** suporte@cogep.com.br
