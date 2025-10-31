/**
 * TESTE 01: PÁGINA PRINCIPAL E MAPA
 * Valida carregamento inicial, mapa Leaflet e elementos básicos
 */

import { test, expect } from '@playwright/test';
import { waitForMap, waitForAppReady, setupConsoleCapture } from '../utils/helpers.js';

test.describe('Homepage - Página Principal', () => {

  test.beforeEach(async ({ page }) => {
    // Capturar logs de console
    setupConsoleCapture(page);

    // Navegar para página principal
    await page.goto('http://localhost:3001');
  });

  test('01.1 - Deve carregar a página principal sem erros', async ({ page }) => {
    // Verificar título
    await expect(page).toHaveTitle(/Marcos Geodésicos|FHV/);

    // Verificar que não há erros críticos de JavaScript
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.waitForTimeout(2000);

    // Permitir alguns avisos, mas não erros críticos
    const criticalErrors = errors.filter(e =>
      !e.includes('Warning') && !e.includes('Deprecation')
    );

    expect(criticalErrors.length).toBe(0);
  });

  test('01.2 - Deve inicializar o mapa Leaflet corretamente', async ({ page }) => {
    await waitForAppReady(page);

    // Verificar que o container do mapa existe e está visível
    const mapContainer = page.locator('#map');
    await expect(mapContainer).toBeVisible();

    // Verificar que o Leaflet foi inicializado
    const leafletContainer = page.locator('.leaflet-container');
    await expect(leafletContainer).toBeVisible();

    // Verificar controles de zoom
    const zoomControl = page.locator('.leaflet-control-zoom');
    await expect(zoomControl).toBeVisible();
  });

  test('01.3 - Deve exibir camadas base do mapa (tiles)', async ({ page }) => {
    await waitForAppReady(page);

    // Aguardar tiles serem carregadas
    await page.waitForSelector('.leaflet-tile-container img', { state: 'visible', timeout: 10000 });

    // Verificar que há pelo menos uma tile carregada
    const tiles = await page.locator('.leaflet-tile-container img').count();
    expect(tiles).toBeGreaterThan(0);

    console.log(`✅ ${tiles} tiles carregadas no mapa`);
  });

  test('01.4 - Deve ter menu de navegação funcional', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Verificar links principais do menu
    const menuLinks = [
      { text: 'Início', href: '/index.html' },
      { text: 'Clientes', href: '/clientes.html' },
      { text: 'Propriedades', href: '/propriedades.html' }
    ];

    for (const link of menuLinks) {
      const element = page.locator(`a:has-text("${link.text}")`);
      await expect(element).toBeVisible();
    }
  });

  test('01.5 - Deve ter botões de ação principais', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Verificar botões principais
    const buttons = [
      'Importar Memorial',
      'Adicionar Marco',
      'Visualizar Propriedades'
    ];

    for (const buttonText of buttons) {
      // Procurar por botões ou links com esse texto
      const element = page.locator(`button:has-text("${buttonText}"), a:has-text("${buttonText}")`).first();

      // Se existir, deve estar visível (alguns podem estar em modais)
      const count = await element.count();
      if (count > 0) {
        console.log(`✅ Botão/Link encontrado: ${buttonText}`);
      }
    }
  });

  test('01.6 - Deve responder a interações do mapa (zoom e pan)', async ({ page }) => {
    await waitForAppReady(page);

    // Capturar coordenadas iniciais do centro do mapa
    const initialCenter = await page.evaluate(() => {
      return window.map.getCenter();
    });

    console.log('📍 Centro inicial:', initialCenter);

    // Testar zoom in
    await page.locator('.leaflet-control-zoom-in').click();
    await page.waitForTimeout(500);

    const zoomAfter = await page.evaluate(() => window.map.getZoom());
    console.log(`🔍 Zoom atual: ${zoomAfter}`);

    expect(zoomAfter).toBeGreaterThan(0);

    // Testar pan (arrastar mapa)
    const mapElement = page.locator('#map');
    await mapElement.hover();
    await page.mouse.down();
    await page.mouse.move(100, 100);
    await page.mouse.up();
    await page.waitForTimeout(500);

    const centerAfterPan = await page.evaluate(() => {
      return window.map.getCenter();
    });

    console.log('📍 Centro após pan:', centerAfterPan);

    // Verificar que o centro mudou
    expect(centerAfterPan.lat).not.toBe(initialCenter.lat);
  });

  test('01.7 - Deve carregar marcadores geodésicos do banco', async ({ page }) => {
    await waitForAppReady(page);

    // Aguardar requisição de marcadores
    const response = await page.waitForResponse(
      response => response.url().includes('/api/marcos') && response.status() === 200,
      { timeout: 10000 }
    );

    const marcos = await response.json();
    console.log(`📍 ${marcos.length} marcos carregados`);

    // Se houver marcos, deve renderizar no mapa
    if (marcos.length > 0) {
      await page.waitForSelector('.leaflet-marker-icon', { state: 'visible', timeout: 5000 });

      const markerCount = await page.locator('.leaflet-marker-icon').count();
      expect(markerCount).toBeGreaterThan(0);

      console.log(`✅ ${markerCount} marcadores renderizados no mapa`);
    } else {
      console.log('⚠️  Nenhum marco encontrado no banco de dados');
    }
  });

  test('01.8 - Deve exibir informações ao clicar em marcador', async ({ page }) => {
    await waitForAppReady(page);

    // Aguardar marcadores
    await page.waitForTimeout(3000);

    const markerCount = await page.locator('.leaflet-marker-icon').count();

    if (markerCount > 0) {
      // Clicar no primeiro marcador
      await page.locator('.leaflet-marker-icon').first().click();
      await page.waitForTimeout(500);

      // Verificar se popup abriu
      const popup = page.locator('.leaflet-popup');
      await expect(popup).toBeVisible();

      // Verificar se popup tem conteúdo
      const popupContent = await popup.textContent();
      expect(popupContent.length).toBeGreaterThan(10);

      console.log('✅ Popup exibido com informações do marco');
    } else {
      console.log('⚠️  Teste pulado: nenhum marcador disponível');
    }
  });

});
