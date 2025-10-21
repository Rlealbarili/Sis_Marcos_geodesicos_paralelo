# Frontend Integrado com PostgreSQL + PostGIS

## Alterações Realizadas

### 1. Atualização da API URL
**Arquivo:** `frontend/script.js` (linha 2)

```javascript
// ANTES:
const API_URL = window.location.origin;

// DEPOIS:
const API_URL = 'http://localhost:3001';  // PostgreSQL + PostGIS API
```

### 2. Novo Módulo de Busca por Raio
**Arquivo:** `frontend/busca-raio.js` (NOVO)

Funcionalidades implementadas:
- ✅ Busca geoespacial por raio usando PostGIS
- ✅ Desenho de círculo no mapa
- ✅ Painel lateral com resultados
- ✅ Cálculo preciso de distâncias
- ✅ Localização de marcos no mapa
- ✅ Interface responsiva

### 3. Inclusão no HTML
**Arquivo:** `frontend/index.html` (após linha 506)

```html
<script src="busca-raio.js"></script>
<script>
    // Inicialização automática do controle de busca
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (typeof map !== 'undefined' && map) {
                adicionarControleBuscaRaio();
            }
        }, 1000);
    });
</script>
```

## Como Usar

### 1. Iniciar o Servidor PostgreSQL

```bash
npm run start:postgres
```

Servidor rodando em: `http://localhost:3001`

### 2. Abrir o Frontend

Abra no navegador:
```
http://localhost:3001/index.html
```

### 3. Usar a Busca por Raio

1. No mapa, localize a região desejada
2. No canto superior direito, veja o painel "🔍 Busca por Raio"
3. Ajuste o raio desejado (padrão: 5km)
4. Clique em "🎯 Buscar Aqui"
5. Veja o círculo desenhado e os resultados no painel lateral

## Funcionalidades da Busca por Raio

### Painel de Controle
- Input numérico para raio (0.1 a 100 km)
- Botão "Buscar Aqui"
- Busca centrada no centro atual do mapa

### Visualização no Mapa
- Círculo azul tracejado mostrando o raio
- Marcador azul no centro da busca
- Popup informativo no centro
- Ajuste automático do zoom

### Painel de Resultados
- Lista ordenada por distância
- Código, tipo e município de cada marco
- Distância em km (2 casas decimais)
- Click para localizar no mapa
- Destaque temporário ao selecionar

### Funções Disponíveis

#### `buscarPorRaio(lat, lng, raioKm)`
Busca marcos num raio específico.

**Parâmetros:**
- `lat` (number): Latitude do centro
- `lng` (number): Longitude do centro
- `raioKm` (number): Raio em quilômetros

**Retorna:** Promise com objeto contendo:
```javascript
{
    centro: { lat, lng },
    raio_metros: number,
    total_encontrados: number,
    marcos: [
        {
            codigo: string,
            tipo: string,
            municipio: string,
            latitude: number,
            longitude: number,
            geojson: object,
            distancia_metros: number
        }
    ]
}
```

#### `localizarMarcoNoMapa(codigo, lat, lng)`
Centraliza e destaca um marco específico no mapa.

#### `fecharResultadosBusca()`
Fecha o painel de resultados e remove o círculo do mapa.

#### `adicionarControleBuscaRaio()`
Adiciona o controle de busca ao mapa (chamado automaticamente).

## Endpoints da API Utilizados

### GET /api/marcos/raio/:lat/:lng/:raio
Busca marcos num raio específico.

**Exemplo:**
```javascript
GET /api/marcos/raio/-25.4245693/-49.6158113/5000
```

**Resposta:**
```json
{
    "centro": { "lat": -25.4245693, "lng": -49.6158113 },
    "raio_metros": 5000,
    "total_encontrados": 101,
    "marcos": [...]
}
```

## Performance

Exemplo de busca em Londrina:
- **Raio:** 5km
- **Marcos encontrados:** 101
- **Tempo de resposta:** ~18ms
- **Cálculo:** PostGIS nativo (geography)

## Customização

### Cores do Círculo
Edite em `busca-raio.js`:
```javascript
circuloBusca = L.circle([lat, lng], {
    radius: raioMetros,
    color: '#3388ff',        // Cor da borda
    fillColor: '#3388ff',    // Cor do preenchimento
    fillOpacity: 0.1,        // Opacidade (0-1)
    weight: 2,               // Espessura da borda
    dashArray: '5, 10'       // Padrão tracejado
});
```

### Posição do Painel de Resultados
Edite em `busca-raio.js`:
```javascript
div.style.cssText = `
    position: absolute;
    top: 80px;      // Distância do topo
    right: 20px;    // Distância da direita
    ...
`;
```

### Posição do Controle de Busca
Edite em `busca-raio.js`:
```javascript
options: {
    position: 'topright'  // topleft, topright, bottomleft, bottomright
}
```

## Compatibilidade

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Edge 90+
- ✅ Safari 14+

## Troubleshooting

### Controle não aparece
1. Verifique se o servidor PostgreSQL está rodando na porta 3001
2. Abra o console (F12) e veja se há erros
3. Verifique se a variável `map` está definida

### Busca não funciona
1. Verifique a conexão com a API: `http://localhost:3001/api/health`
2. Teste manualmente: `http://localhost:3001/api/marcos/raio/-25.42/-49.61/5000`
3. Veja os logs no console

### Círculo não aparece
1. Verifique se o raio é válido (> 0)
2. Veja se há marcos no raio especificado
3. Tente aumentar o raio

## Próximas Melhorias

- [ ] Heat map de densidade
- [ ] Clustering avançado
- [ ] Exportar resultados da busca
- [ ] Busca por polígono
- [ ] Análise de proximidade
- [ ] Rotas entre marcos

## Suporte

Para problemas ou dúvidas:
1. Verifique os logs do console (F12)
2. Teste os endpoints da API diretamente
3. Consulte a documentação do PostGIS

---

**Desenvolvido com PostgreSQL 16.4 + PostGIS 3.4.3**
