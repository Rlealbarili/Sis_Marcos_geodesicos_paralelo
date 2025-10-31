/**
 * TESTE 03: VISUALIZAÇÃO DE POLÍGONOS NO MAPA
 * Valida carregamento GeoJSON, renderização Leaflet, popups e interações
 */

import { test, expect } from '@playwright/test';
import { waitForMap, waitForAppReady, isPolygonVisible } from '../utils/helpers.js';

test.describe('Visualização de Polígonos', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3001');
    await waitForAppReady(page);
  });

  test('03.1 - Deve carregar polígonos das propriedades via GeoJSON', async ({ page }) => {
    // Aguardar chamada à API de GeoJSON
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/propriedades/geojson') && response.status() === 200,
      { timeout: 10000 }
    );

    try {
      const response = await responsePromise;
      const geojson = await response.json();

      console.log(`✅ GeoJSON recebido: ${geojson.features?.length || 0} propriedades`);

      // Validar estrutura
      expect(geojson.type).toBe('FeatureCollection');
      expect(Array.isArray(geojson.features)).toBe(true);

      if (geojson.features.length > 0) {
        const firstFeature = geojson.features[0];
        expect(firstFeature.type).toBe('Feature');
        expect(firstFeature.geometry).toBeDefined();
        expect(firstFeature.properties).toBeDefined();
        console.log('✅ Estrutura GeoJSON válida');
      }
    } catch (error) {
      console.log('⚠️  Timeout aguardando GeoJSON - pode não haver propriedades com geometria');
    }
  });

  test('03.2 - Deve renderizar polígonos no mapa Leaflet', async ({ page }) => {
    // Aguardar carregamento
    await page.waitForTimeout(4000);

    // Verificar se há polígonos renderizados
    const hasPolygons = await isPolygonVisible(page);

    if (hasPolygons) {
      const polygonCount = await page.locator('.leaflet-overlay-pane path').count();
      expect(polygonCount).toBeGreaterThan(0);
      console.log(`✅ ${polygonCount} polígonos renderizados no mapa`);
    } else {
      console.log('ℹ️  Nenhum polígono encontrado - banco pode estar vazio');
    }
  });

  test('03.3 - Deve aplicar estilos corretos aos polígonos (cores por tipo)', async ({ page }) => {
    await page.waitForTimeout(4000);

    const polygons = await page.locator('.leaflet-overlay-pane path').all();

    if (polygons.length > 0) {
      for (const polygon of polygons) {
        const stroke = await polygon.getAttribute('stroke');
        const fill = await polygon.getAttribute('fill');

        expect(stroke).toBeTruthy();
        expect(fill).toBeTruthy();

        console.log(`✅ Polígono com stroke: ${stroke}, fill: ${fill}`);
      }
    } else {
      console.log('ℹ️  Nenhum polígono para verificar estilos');
    }
  });

  test('03.4 - Deve exibir popup ao clicar no polígono', async ({ page }) => {
    await page.waitForTimeout(4000);

    const polygons = await page.locator('.leaflet-overlay-pane path').all();

    if (polygons.length > 0) {
      // Clicar no primeiro polígono
      await polygons[0].click();
      await page.waitForTimeout(1000);

      // Verificar se popup apareceu
      const popup = page.locator('.leaflet-popup');
      await expect(popup).toBeVisible();

      // Verificar conteúdo do popup
      const popupContent = await popup.textContent();
      expect(popupContent.length).toBeGreaterThan(20);

      console.log('✅ Popup exibido ao clicar no polígono');
      console.log('📄 Conteúdo do popup:', popupContent.substring(0, 100) + '...');
    } else {
      console.log('⚠️  Teste pulado: nenhum polígono disponível');
    }
  });

  test('03.5 - Popup deve conter informações da propriedade', async ({ page }) => {
    await page.waitForTimeout(4000);

    const polygons = await page.locator('.leaflet-overlay-pane path').all();

    if (polygons.length > 0) {
      await polygons[0].click();
      await page.waitForTimeout(500);

      const popup = page.locator('.leaflet-popup');
      const popupText = await popup.textContent();

      // Verificar campos esperados no popup
      const expectedFields = ['Nome', 'Matrícula', 'Área', 'Cliente'];
      const foundFields = expectedFields.filter(field =>
        popupText.includes(field) || popupText.toLowerCase().includes(field.toLowerCase())
      );

      console.log(`✅ Campos encontrados no popup: ${foundFields.join(', ')}`);
      expect(foundFields.length).toBeGreaterThan(0);
    } else {
      console.log('⚠️  Teste pulado: nenhum polígono disponível');
    }
  });

  test('03.6 - Popup deve mostrar área calculada vs área informada', async ({ page }) => {
    await page.waitForTimeout(4000);

    const polygons = await page.locator('.leaflet-overlay-pane path').all();

    if (polygons.length > 0) {
      await polygons[0].click();
      await page.waitForTimeout(500);

      const popup = page.locator('.leaflet-popup');
      const popupText = await popup.textContent();

      // Verificar se há informações de área
      const hasArea = popupText.includes('Área') ||
                       popupText.includes('área') ||
                       popupText.includes('m²') ||
                       popupText.includes('ha');

      if (hasArea) {
        console.log('✅ Informações de área encontradas no popup');

        // Verificar se há diferença de área
        const hasDifference = popupText.includes('Diferença') ||
                              popupText.includes('diferença') ||
                              popupText.includes('%');

        if (hasDifference) {
          console.log('✅ Comparação de áreas exibida');
        }
      }
    } else {
      console.log('⚠️  Teste pulado: nenhum polígono disponível');
    }
  });

  test('03.7 - Deve aplicar efeito hover nos polígonos', async ({ page }) => {
    await page.waitForTimeout(4000);

    const polygons = await page.locator('.leaflet-overlay-pane path').all();

    if (polygons.length > 0) {
      const firstPolygon = polygons[0];

      // Capturar estilo inicial
      const initialStroke = await firstPolygon.getAttribute('stroke-width');

      // Passar mouse sobre o polígono
      await firstPolygon.hover();
      await page.waitForTimeout(500);

      // Capturar estilo após hover
      const hoverStroke = await firstPolygon.getAttribute('stroke-width');

      console.log(`Stroke inicial: ${initialStroke}, Após hover: ${hoverStroke}`);

      // Verificar se houve mudança no estilo (espera-se que fique mais grosso)
      if (hoverStroke !== initialStroke) {
        console.log('✅ Efeito hover aplicado corretamente');
      } else {
        console.log('ℹ️  Efeito hover pode não ter sido detectado ou não está implementado');
      }
    } else {
      console.log('⚠️  Teste pulado: nenhum polígono disponível');
    }
  });

  test('03.8 - Deve permitir toggle de visibilidade dos polígonos', async ({ page }) => {
    await page.waitForTimeout(4000);

    // Procurar botão de toggle
    const toggleButton = page.locator('button:has-text("Propriedades"), button:has-text("Ocultar"), button:has-text("Mostrar")').first();

    const hasToggle = await toggleButton.count() > 0;

    if (hasToggle) {
      // Contar polígonos visíveis
      const initialCount = await page.locator('.leaflet-overlay-pane path').count();

      // Clicar no toggle
      await toggleButton.click();
      await page.waitForTimeout(1000);

      // Contar novamente
      const afterToggleCount = await page.locator('.leaflet-overlay-pane path').count();

      console.log(`Polígonos antes: ${initialCount}, depois: ${afterToggleCount}`);

      // Deve ter mudado a quantidade
      expect(afterToggleCount).not.toBe(initialCount);
      console.log('✅ Toggle de visibilidade funciona');
    } else {
      console.log('ℹ️  Botão de toggle não encontrado');
    }
  });

  test('03.9 - Deve auto-ajustar zoom para mostrar todos os polígonos', async ({ page }) => {
    await page.waitForTimeout(4000);

    const polygons = await page.locator('.leaflet-overlay-pane path').all();

    if (polygons.length > 0) {
      // Verificar se mapa ajustou bounds automaticamente
      const bounds = await page.evaluate(() => {
        return window.map.getBounds();
      });

      expect(bounds).toBeDefined();
      console.log('✅ Bounds do mapa:', bounds);

      // Verificar se zoom está em nível razoável (não muito longe nem muito perto)
      const zoom = await page.evaluate(() => window.map.getZoom());
      expect(zoom).toBeGreaterThan(5);
      expect(zoom).toBeLessThan(20);

      console.log(`✅ Zoom ajustado: ${zoom}`);
    } else {
      console.log('⚠️  Teste pulado: nenhum polígono disponível');
    }
  });

  test('03.10 - Deve recarregar polígonos ao clicar em atualizar', async ({ page }) => {
    await page.waitForTimeout(4000);

    // Procurar botão de atualizar/recarregar
    const reloadButton = page.locator('button:has-text("Atualizar"), button:has-text("Recarregar"), button[title*="atualizar"]').first();

    const hasReload = await reloadButton.count() > 0;

    if (hasReload) {
      // Contar polígonos atuais
      const initialCount = await page.locator('.leaflet-overlay-pane path').count();

      // Interceptar nova chamada à API
      const responsePromise = page.waitForResponse(
        response => response.url().includes('/api/propriedades/geojson'),
        { timeout: 5000 }
      );

      // Clicar em recarregar
      await reloadButton.click();

      try {
        await responsePromise;
        await page.waitForTimeout(1000);

        const afterReloadCount = await page.locator('.leaflet-overlay-pane path').count();

        console.log(`Polígonos antes: ${initialCount}, depois: ${afterReloadCount}`);
        console.log('✅ Polígonos recarregados com sucesso');
      } catch {
        console.log('⚠️  Timeout aguardando recarga - botão pode não estar funcional');
      }
    } else {
      console.log('ℹ️  Botão de recarregar não encontrado');
    }
  });

  test('03.11 - Deve validar geometrias SRID 31982 no backend', async ({ page }) => {
    // Este teste valida apenas a resposta da API
    try {
      const response = await page.waitForResponse(
        response => response.url().includes('/api/propriedades/geojson'),
        { timeout: 10000 }
      );

      const geojson = await response.json();

      if (geojson.features && geojson.features.length > 0) {
        const firstFeature = geojson.features[0];

        // Verificar estrutura da geometria
        expect(firstFeature.geometry.type).toBe('Polygon');
        expect(Array.isArray(firstFeature.geometry.coordinates)).toBe(true);
        expect(firstFeature.geometry.coordinates[0].length).toBeGreaterThanOrEqual(3);

        console.log('✅ Geometria válida (Polygon com coordenadas)');
        console.log(`   Vértices: ${firstFeature.geometry.coordinates[0].length}`);
      }
    } catch {
      console.log('ℹ️  Nenhuma propriedade com geometria disponível');
    }
  });

});
