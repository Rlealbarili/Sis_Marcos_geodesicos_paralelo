# 🎯 SOLUÇÕES PARA DOWNLOAD SIGEF-PR

**Data:** 05/11/2025
**Status:** 5 OPÇÕES IDENTIFICADAS

---

## 📊 DIAGNÓSTICO ATUAL

```
Problema: URL antiga não funciona (404)
Parcelas: 2.094 (faltam 12.906)
Causa: INCRA mudou estrutura de downloads
```

---

## ✅ OPÇÃO 1: GeoPR - IAT (MAIS FÁCIL) ⭐⭐⭐⭐⭐

### Portal do Paraná hospeda SIGEF!

**URL encontrada:** https://geopr.iat.pr.gov.br/portal/home/item.html?id=2d9b72716c894e04b8bbb05abd1b3837

**Título:** "Imóveis Certificados SIGEF (INCRA) - Visão Geral"

### Como acessar:

1. **Abrir no navegador:**
   ```
   https://geopr.iat.pr.gov.br/portal/home/item.html?id=2d9b72716c894e04b8bbb05abd1b3837
   ```

2. **Procurar botão "Download" ou "Exportar"**

3. **Formatos disponíveis:**
   - Shapefile
   - GeoJSON
   - KML

4. **Se tiver serviço WFS/WMS, copiar URL**

### Vantagens:
- ✅ Oficial do Governo do Paraná
- ✅ Dados atualizados
- ✅ Sem necessidade de login Gov.br
- ✅ Acesso direto
- ✅ Específico para PR

### Script de teste (após obter URL):
```javascript
// Atualizar em: backend/sigef-downloader.js
this.urlTemplates = {
    certificada_particular: 'URL_DO_GEOPR_AQUI.zip'
};
```

---

## ✅ OPÇÃO 2: INCRA Export Script (OFICIAL)

**URL:** https://certificacao.incra.gov.br/csv_shp/export_shp.py

### Como funciona:
Sistema Python de exportação do INCRA

### Possíveis URLs de teste:
```bash
# Tentar variações:
https://certificacao.incra.gov.br/csv_shp/export_shp.py?estado=PR
https://certificacao.incra.gov.br/csv_shp/PR.zip
https://certificacao.incra.gov.br/csv_shp/download/PR.zip
https://certificacao.incra.gov.br/csv_shp/shapefiles/PR.zip
```

### Script de teste:
```bash
# Testar cada URL:
curl -I "https://certificacao.incra.gov.br/csv_shp/export_shp.py?estado=PR"
```

### Problema conhecido:
- ⚠️ Certificado SSL inválido
- ⚠️ Pode requerer login Gov.br

---

## ✅ OPÇÃO 3: Acervo Fundiário INCRA

**URL:** https://acervofundiario.incra.gov.br

### Como acessar:

1. **Criar conta Gov.br** (se não tiver)
   - https://www.gov.br

2. **Fazer login no Acervo:**
   - https://acervofundiario.incra.gov.br/acervo/login.php

3. **Navegar até Downloads:**
   - Seção "SIGEF"
   - Filtrar por estado: PR
   - Download Shapefile

### Vantagens:
- ✅ Oficial e completo
- ✅ Dados mais atualizados

### Desvantagens:
- ⚠️ Requer cadastro Gov.br
- ⚠️ Processo manual
- ⚠️ Pode ser lento

---

## ✅ OPÇÃO 4: API WFS do SIGEF

**Serviço:** Web Feature Service (se disponível)

### URLs possíveis:
```
https://sigef.incra.gov.br/geo/wfs
https://certificacao.incra.gov.br/geo/wfs
https://acervofundiario.incra.gov.br/geo/wfs
```

### Como testar:
```bash
# GetCapabilities
curl "https://sigef.incra.gov.br/geo/wfs?service=WFS&request=GetCapabilities"
```

### Se funcionar, código para integrar:
```javascript
// Usar ogr2ogr
ogr2ogr -f PostgreSQL \
  PG:"host=localhost port=5434 dbname=marcos_geodesicos user=postgres password=marcos123" \
  WFS:"https://sigef.incra.gov.br/geo/wfs" \
  -t_srs EPSG:31982 \
  -nln sigef_parcelas_novo
```

---

## ✅ OPÇÃO 5: Forest-GIS Mirror (ALTERNATIVA)

**URL:** https://forest-gis.com/dados-geoincra/

Portal independente que costuma hospedar espelhos dos dados SIGEF

### Como acessar:
1. Abrir: https://forest-gis.com/dados-geoincra/
2. Procurar por "SIGEF PR" ou "Parcelas Certificadas PR"
3. Download direto

### Vantagens:
- ✅ Sem necessidade de login
- ✅ Geralmente mais rápido
- ✅ Pode ter dados consolidados

### Desvantagens:
- ⚠️ Pode estar desatualizado
- ⚠️ Não é oficial (mas usa dados oficiais)

---

## 🔧 SCRIPTS PRONTOS PARA TESTAR

### Script 1: Testar URLs Alternativas

Criei: `backend/scripts/testar_urls_sigef.js`

```javascript
const https = require('https');

const urlsParaTestar = [
    'https://certificacao.incra.gov.br/csv_shp/PR.zip',
    'https://certificacao.incra.gov.br/csv_shp/export_shp.py?estado=PR',
    'https://certificacao.incra.gov.br/csv_shp/download/PR.zip',
    'https://certificacao.incra.gov.br/csv_shp/shapefiles/PR.zip',
    'https://sigef.incra.gov.br/geo/parcelas.kml?estado=PR'
];

async function testarURLs() {
    for (const url of urlsParaTestar) {
        console.log(`\n🔍 Testando: ${url}`);

        try {
            const response = await fetch(url, {
                method: 'HEAD',
                agent: new https.Agent({ rejectUnauthorized: false })
            });

            console.log(`   Status: ${response.status}`);
            console.log(`   Type: ${response.headers.get('content-type')}`);
            console.log(`   Size: ${response.headers.get('content-length')}`);

            if (response.status === 200) {
                console.log(`   ✅ FUNCIONA!`);
            }
        } catch (error) {
            console.log(`   ❌ Erro: ${error.message}`);
        }
    }
}

testarURLs();
```

---

## 🚀 PLANO DE AÇÃO IMEDIATO

### PASSO 1: GeoPR (15 min) ⭐ COMEÇAR AQUI

```bash
1. Abrir navegador
2. Ir para: https://geopr.iat.pr.gov.br/portal/home/item.html?id=2d9b72716c894e04b8bbb05abd1b3837
3. Procurar botão "Download" ou "API"
4. Se encontrar WFS: copiar URL
5. Se encontrar Download: baixar ZIP
6. Me avisar o que encontrou!
```

**SE ENCONTRAR URL DE DOWNLOAD:**
- Me passe a URL
- Atualizo código automaticamente
- Rodo download completo
- Importo ~15.000 parcelas

---

### PASSO 2: Se GeoPR não funcionar (30 min)

```bash
1. Criar conta Gov.br (se não tiver)
   URL: https://www.gov.br

2. Acessar Acervo Fundiário
   URL: https://acervofundiario.incra.gov.br/acervo/login.php

3. Navegar até SIGEF → Downloads
4. Filtrar: Paraná (PR)
5. Download Shapefile
6. Me avisar quando terminar download

7. Importar manualmente:
   node backend/scripts/importar_sigef_manual.js caminho/do/arquivo.zip
```

---

### PASSO 3: Se nada funcionar (ÚLTIMA OPÇÃO)

**Contatar INCRA-SR09:**
```
Tel: (41) 3250-8300
Email: coordenacao.cartografia@incra.gov.br
Solicitar: Shapefile de parcelas certificadas PR
```

**OU**

**Contatar Prefeitura Campo Largo:**
```
Tel: (41) 3291-5127
Solicitar: Dados SIGEF do município
(Eles já têm integrado no SIG deles!)
```

---

## 📋 CHECKLIST

- [ ] Tentou GeoPR (Opção 1)
- [ ] Encontrou URL de download?
- [ ] Se sim: passou URL para atualizar código
- [ ] Se não: tentou Acervo Fundiário (Opção 3)
- [ ] Conseguiu baixar arquivo?
- [ ] Se sim: importou com script
- [ ] Se não: entrou em contato INCRA/Prefeitura

---

## 💡 RECOMENDAÇÃO

**COMECE PELO GeoPR (Opção 1):**

É o portal oficial do Paraná e provavelmente tem:
- ✅ Dados atualizados
- ✅ Acesso sem login
- ✅ Download direto
- ✅ Específico para PR

**Se encontrar a URL lá, me avise que atualizo o código em 5 minutos!**

---

## 📞 PRÓXIMA AÇÃO

**AGORA MESMO:**

1. Abra: https://geopr.iat.pr.gov.br/portal/home/item.html?id=2d9b72716c894e04b8bbb05abd1b3837

2. Procure por:
   - Botão "Download"
   - Botão "Exportar"
   - Botão "API"
   - Link "WFS" ou "WMS"
   - Qualquer URL que termine em .zip

3. **Me diga o que encontrou!**

4. Eu atualizo o código e rodo automaticamente! 🚀

---

**Aguardando seu retorno com a URL ou o que encontrou no GeoPR!**
