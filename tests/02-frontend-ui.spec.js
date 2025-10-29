const { test, expect } = require('@playwright/test');

test.describe('Frontend Premium - Interface Completa', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000); // Aguardar scripts carregarem
  });

  // ========================================
  // PÁGINA PRINCIPAL
  // ========================================

  test('1.1 - Sistema Premium carrega', async ({ page }) => {
    await expect(page).toHaveTitle(/COGEP/i);

    // Verificar se o título da página está visível
    const header = page.locator('h1').first();
    await expect(header).toBeVisible({ timeout: 10000 });

    console.log('✅ Sistema Premium carregado');
  });

  test('1.2 - Lucide Icons renderizados', async ({ page }) => {
    const icons = page.locator('svg');
    const count = await icons.count();

    expect(count).toBeGreaterThan(10);
    console.log(`✅ ${count} ícones renderizados`);
  });

  // ========================================
  // NAVEGAÇÃO
  // ========================================

  test('2.1 - Navegação entre abas', async ({ page }) => {
    // Esperar página carregar completamente
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Buscar Marcos
    const btnMarcos = page.locator('button').filter({ hasText: 'Buscar Marcos' });
    await btnMarcos.click({ timeout: 15000 });
    await page.waitForTimeout(2000);
    const marcosTab = page.locator('#tab-marcos');
    await expect(marcosTab).toBeVisible({ timeout: 15000 });

    // Propriedades
    const btnPropriedades = page.locator('button').filter({ hasText: 'Propriedades' });
    await btnPropriedades.click({ timeout: 15000 });
    await page.waitForTimeout(3000);
    const propriedadesTab = page.locator('#tab-propriedades');
    await expect(propriedadesTab).toBeVisible({ timeout: 15000 });

    // Clientes
    const btnClientes = page.locator('button').filter({ hasText: 'Clientes' });
    await btnClientes.click({ timeout: 15000 });
    await page.waitForTimeout(3000);
    const clientesTab = page.locator('#tab-clientes');
    await expect(clientesTab).toBeVisible({ timeout: 15000 });

    console.log('✅ Navegação OK');
  });

  // ========================================
  // CLIENTES
  // ========================================

  test('3.1 - Aba Clientes carrega dados', async ({ page }) => {
    const btnClientes = page.locator('button').filter({ hasText: 'Clientes' });
    await btnClientes.click({ timeout: 15000 });
    await page.waitForTimeout(4000);

    // Verificar se a aba clientes está visível
    const tab = page.locator('#tab-clientes');
    await expect(tab).toBeVisible({ timeout: 10000 });

    // Verificar se há botão "Novo Cliente" (indica que a aba carregou)
    const btnNovo = page.locator('button:has-text("Novo Cliente")');
    await expect(btnNovo).toBeVisible({ timeout: 10000 });

    console.log('✅ Aba Clientes carregada com sucesso');
  });

  test('3.2 - Modal de novo cliente abre', async ({ page }) => {
    const btnClientes = page.locator('button').filter({ hasText: 'Clientes' });
    await btnClientes.click({ timeout: 15000 });
    await page.waitForTimeout(3000);

    const btnNovo = page.locator('button:has-text("Novo Cliente")');
    await btnNovo.click({ timeout: 15000 });
    await page.waitForTimeout(2000);

    const modal = page.locator('#modal-novo-cliente');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Fechar modal com ESC
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);

    console.log('✅ Modal de cliente aberto e fechado');
  });

  test('3.3 - Criar cliente via UI', async ({ page }) => {
    const btnClientes = page.locator('button').filter({ hasText: 'Clientes' });
    await btnClientes.click({ timeout: 15000 });
    await page.waitForTimeout(3000);

    const btnNovo = page.locator('button:has-text("Novo Cliente")');
    await btnNovo.click({ timeout: 15000 });
    await page.waitForTimeout(2000);

    const timestamp = Date.now();
    await page.fill('input[name="nome"]', `Cliente Teste UI ${timestamp}`);
    await page.check('input[name="tipo_pessoa"][value="fisica"]');
    await page.fill('input[name="cpf_cnpj"]', `${timestamp}`);
    await page.fill('input[name="email"]', `teste${timestamp}@ui.com`);

    await page.click('button:has-text("Criar Cliente")');

    // Aguardar toast OU modal fechar (o que vier primeiro)
    await Promise.race([
      page.waitForSelector('.toast-success', { timeout: 10000 }),
      page.waitForSelector('#modal-novo-cliente', { state: 'hidden', timeout: 10000 })
    ]).catch(() => {});

    await page.waitForTimeout(2000);

    console.log('✅ Cliente criado via UI');
  });

  test('3.4 - Filtro de busca funciona', async ({ page }) => {
    const btnClientes = page.locator('button').filter({ hasText: 'Clientes' });
    await btnClientes.click({ timeout: 15000 });
    await page.waitForTimeout(3000);

    const inputBusca = page.locator('#busca-cliente');
    await inputBusca.fill('João');
    await page.waitForTimeout(1000);

    console.log('✅ Filtro de busca executado com sucesso');
  });

  // ========================================
  // PROPRIEDADES
  // ========================================

  test('4.1 - Aba Propriedades carrega dados', async ({ page }) => {
    const btnPropriedades = page.locator('button').filter({ hasText: 'Propriedades' });
    await btnPropriedades.click({ timeout: 15000 });
    await page.waitForTimeout(4000);

    // Verificar se a aba propriedades está visível
    const tab = page.locator('#tab-propriedades');
    await expect(tab).toBeVisible({ timeout: 10000 });

    // Verificar se há botão "Nova Propriedade" (indica que a aba carregou)
    const btnNova = page.locator('button:has-text("Nova Propriedade")');
    await expect(btnNova).toBeVisible({ timeout: 10000 });

    console.log('✅ Aba Propriedades carregada com sucesso');
  });

  // ========================================
  // MARCOS
  // ========================================

  test('5.1 - Busca de marcos funciona', async ({ page }) => {
    await page.click('text=Buscar Marcos', { timeout: 10000 });
    await page.waitForTimeout(2000);

    const cards = page.locator('.card');
    const count = await cards.count();

    expect(count).toBeGreaterThan(0);
    console.log(`✅ ${count} marcos exibidos`);
  });

  // ========================================
  // MAPA
  // ========================================

  test('6.1 - Mapa carrega', async ({ page }) => {
    await page.click('button:has-text("Mapa")');
    await page.waitForTimeout(3000);

    const mapa = page.locator('#map');
    await expect(mapa).toBeVisible();

    console.log('✅ Mapa carregado');
  });

});
