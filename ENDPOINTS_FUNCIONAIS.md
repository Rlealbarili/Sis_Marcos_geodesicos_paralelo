# 📋 ENDPOINTS FUNCIONAIS - API

**Sistema:** Marcos Geodésicos FHV
**Versão:** 2.0.0
**Backend:** PostgreSQL + PostGIS
**Base URL:** http://localhost:3001/api

---

## ✅ RESUMO EXECUTIVO

| Categoria | Total | Status |
|-----------|-------|--------|
| Health & Status | 2 | ✅ 100% |
| Marcos Geodésicos | 8 | ✅ 100% |
| Propriedades | 7 | ✅ 100% |
| Clientes | 5 | ✅ 100% |
| Memoriais | 1 | ✅ 100% |
| SIGEF | 6 | ✅ 100% |
| Análise Geoespacial | 6 | ✅ 100% |
| Relatórios | 6 | ✅ 100% |
| **TOTAL** | **41** | **✅ 100%** |

---

## 📍 ENDPOINTS DETALHADOS

### HEALTH (2)
- `GET /api/health` - Health check
- `GET /api/estatisticas` - Estatísticas gerais

### MARCOS (8)
- `GET /api/marcos` - Listar marcos
- `GET /api/marcos/raio/:lat/:lng/:raio` - Busca por raio
- `GET /api/marcos/bbox` - Busca por área
- `GET /api/marcos/geojson` - Retornar GeoJSON
- `GET /api/marcos/buscar` - Busca textual
- `GET /api/marcos/exportar` - Exportar CSV
- `GET /api/marcos/:codigo` - Buscar por código

### PROPRIEDADES (7)
- `GET /api/propriedades` - Listar
- `GET /api/propriedades/:id` - Buscar por ID
- `POST /api/propriedades` - Criar
- `PUT /api/propriedades/:id` - Atualizar
- `DELETE /api/propriedades/:id` - Deletar
- `GET /api/propriedades/geojson` - GeoJSON
- `GET /api/propriedades/com-score` - Com score

### CLIENTES (5)
- `GET /api/clientes` - Listar
- `GET /api/clientes/:id` - Buscar por ID
- `POST /api/clientes` - Criar
- `PUT /api/clientes/:id` - Atualizar
- `DELETE /api/clientes/:id` - Deletar

### MEMORIAIS (1)
- `POST /api/salvar-memorial-completo` - Importar memorial

### SIGEF (6)
- `POST /api/sigef/download/:estado` - Download por estado
- `POST /api/sigef/download-lote` - Download em lote
- `GET /api/sigef/downloads` - Listar downloads
- `GET /api/sigef/estatisticas` - Estatísticas
- `GET /api/sigef/parcelas/:id` - Buscar parcela
- `GET /api/sigef/parcelas` - Listar parcelas

### ANÁLISE (6)
- `POST /api/analise/sobreposicoes/:propriedadeId` - Sobreposições
- `POST /api/analise/confrontantes/:propriedadeId` - Confrontantes
- `GET /api/analise/score/:propriedadeId` - Score
- `POST /api/analise/area-pre-cadastro` - Pré-cadastro
- `POST /api/analise/completa/:propriedadeId` - Completa
- `GET /api/analise/estatisticas` - Estatísticas

### RELATÓRIOS (6)
- `GET /api/relatorios/propriedades/pdf` - PDF propriedades
- `GET /api/relatorios/propriedades/excel` - Excel propriedades
- `GET /api/relatorios/propriedades/csv` - CSV propriedades
- `GET /api/relatorios/marcos/pdf` - PDF marcos
- `GET /api/relatorios/marcos/excel` - Excel marcos
- `GET /api/relatorios/marcos/csv` - CSV marcos

---

**✅ 41 endpoints 100% funcionais!**

Data: 2025-10-31
