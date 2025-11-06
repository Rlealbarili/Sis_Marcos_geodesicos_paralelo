const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const path = require('path');

class DataExporter {
    constructor() {
        this.reportsDir = path.join(__dirname, '../reports');
        this.exportsDir = path.join(__dirname, '../exports');
        this.ensureDirectories();
    }

    async ensureDirectories() {
        try {
            await fs.mkdir(this.reportsDir, { recursive: true });
            await fs.mkdir(this.exportsDir, { recursive: true });
        } catch (error) {
            console.error('Erro ao criar diretórios:', error);
        }
    }

    /**
     * Exporta dados de confrontantes para Excel
     */
    async exportarConfrontantesExcel(propriedadeId, confrontantes) {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Confrontantes');

        // Configurar colunas (dados corretos de parcelas SIGEF)
        sheet.columns = [
            { header: 'Código SIGEF', key: 'codigo', width: 40 },
            { header: 'Proprietário', key: 'proprietario', width: 35 },
            { header: 'Tipo Contato', key: 'tipo_contato', width: 15 },
            { header: 'Matrícula', key: 'matricula', width: 20 },
            { header: 'Município', key: 'municipio', width: 25 },
            { header: 'Área (ha)', key: 'area', width: 15 },
            { header: 'Distância (m)', key: 'distancia', width: 15 },
            { header: 'Azimute (°)', key: 'azimute', width: 15 }
        ];

        // Estilizar cabeçalho
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // Adicionar dados (usar campos corretos das parcelas SIGEF)
        confrontantes.forEach(c => {
            sheet.addRow({
                codigo: c.codigo_parcela || 'N/A',
                proprietario: c.proprietario || 'N/A',
                tipo_contato: c.tipo_contato === 'limite_comum' ? 'Limite Comum' : 'Próximo',
                matricula: c.matricula || 'N/A',
                municipio: c.municipio || 'N/A',
                area: c.area_ha ? parseFloat(c.area_ha).toFixed(2) : 'N/A',
                distancia: c.distancia_m ? parseFloat(c.distancia_m).toFixed(2) : 'N/A',
                azimute: c.azimute ? parseFloat(c.azimute).toFixed(2) : 'N/A'
            });
        });

        // Adicionar filtros
        sheet.autoFilter = {
            from: 'A1',
            to: `H${sheet.rowCount}`
        };

        // Salvar arquivo
        const filename = `confrontantes_${propriedadeId}_${Date.now()}.xlsx`;
        const filepath = path.join(this.exportsDir, filename);
        await workbook.xlsx.writeFile(filepath);

        return filepath;
    }

    /**
     * Exporta dados de sobreposições para Excel
     */
    async exportarSobreposicoesExcel(propriedadeId, sobreposicoes) {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Sobreposições');

        // Configurar colunas
        sheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Nome', key: 'nome', width: 30 },
            { header: 'Matrícula', key: 'matricula', width: 20 },
            { header: 'Município', key: 'municipio', width: 25 },
            { header: 'Área Original (m²)', key: 'area_original', width: 18 },
            { header: 'Área Sobreposição (m²)', key: 'area_sobreposicao', width: 22 },
            { header: '% Sobreposição', key: 'percentual', width: 18 },
            { header: 'Severidade', key: 'severidade', width: 15 },
            { header: 'Observações', key: 'observacoes', width: 40 }
        ];

        // Estilizar cabeçalho
        sheet.getRow(1).font = { bold: true };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE74C3C' }
        };
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        // Adicionar dados
        sobreposicoes.forEach(s => {
            const percentual = parseFloat(s.percentual_sobreposicao) || 0;
            let severidade = 'Baixa';
            if (percentual > 50) severidade = 'Alta';
            else if (percentual > 20) severidade = 'Média';

            const row = sheet.addRow({
                id: s.id,
                nome: s.nome_propriedade,
                matricula: s.matricula,
                municipio: s.municipio,
                area_original: s.area_m2 ? parseFloat(s.area_m2).toFixed(2) : 'N/A',
                area_sobreposicao: s.area_sobreposicao ? parseFloat(s.area_sobreposicao).toFixed(2) : 'N/A',
                percentual: percentual.toFixed(2) + '%',
                severidade: severidade,
                observacoes: s.observacoes || ''
            });

            // Colorir linha baseado na severidade
            const color = severidade === 'Alta' ? 'FFFCE4EC' : severidade === 'Média' ? 'FFFFF3E0' : 'FFE8F5E9';
            row.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: color }
            };
        });

        // Adicionar filtros
        sheet.autoFilter = {
            from: 'A1',
            to: `I${sheet.rowCount}`
        };

        // Salvar arquivo
        const filename = `sobreposicoes_${propriedadeId}_${Date.now()}.xlsx`;
        const filepath = path.join(this.exportsDir, filename);
        await workbook.xlsx.writeFile(filepath);

        return filepath;
    }

    /**
     * Exporta dados de confrontantes para CSV
     */
    async exportarConfrontantesCSV(propriedadeId, confrontantes) {
        const csv = require('csv-writer').createObjectCsvWriter;

        const filename = `confrontantes_${propriedadeId}_${Date.now()}.csv`;
        const filepath = path.join(this.exportsDir, filename);

        const csvWriter = csv({
            path: filepath,
            header: [
                { id: 'codigo', title: 'Código SIGEF' },
                { id: 'proprietario', title: 'Proprietário' },
                { id: 'tipo_contato', title: 'Tipo Contato' },
                { id: 'matricula', title: 'Matrícula' },
                { id: 'municipio', title: 'Município' },
                { id: 'area', title: 'Área (ha)' },
                { id: 'distancia', title: 'Distância (m)' },
                { id: 'azimute', title: 'Azimute (°)' }
            ],
            fieldDelimiter: ';',
            encoding: 'utf8'
        });

        const records = confrontantes.map(c => ({
            codigo: c.codigo_parcela || 'N/A',
            proprietario: c.proprietario || 'N/A',
            tipo_contato: c.tipo_contato === 'limite_comum' ? 'Limite Comum' : 'Próximo',
            matricula: c.matricula || 'N/A',
            municipio: c.municipio || 'N/A',
            area: c.area_ha ? parseFloat(c.area_ha).toFixed(2) : 'N/A',
            distancia: c.distancia_m ? parseFloat(c.distancia_m).toFixed(2) : 'N/A',
            azimute: c.azimute ? parseFloat(c.azimute).toFixed(2) : 'N/A'
        }));

        await csvWriter.writeRecords(records);
        return filepath;
    }

    /**
     * Exporta análise completa para Excel (múltiplas abas)
     */
    async exportarAnaliseCompletaExcel(propriedadeId, analiseCompleta) {
        const workbook = new ExcelJS.Workbook();

        // Aba 1: Resumo
        const resumoSheet = workbook.addWorksheet('Resumo');
        resumoSheet.columns = [
            { header: 'Métrica', key: 'metrica', width: 30 },
            { header: 'Valor', key: 'valor', width: 40 }
        ];

        resumoSheet.addRow({ metrica: 'Propriedade ID', valor: propriedadeId });
        resumoSheet.addRow({ metrica: 'Nome', valor: analiseCompleta.propriedade?.nome_propriedade || 'N/A' });
        resumoSheet.addRow({ metrica: 'Score de Qualidade', valor: analiseCompleta.score?.score_total || 'N/A' });
        resumoSheet.addRow({ metrica: 'Total de Confrontantes', valor: analiseCompleta.confrontantes?.length || 0 });
        resumoSheet.addRow({ metrica: 'Total de Sobreposições', valor: analiseCompleta.sobreposicoes?.length || 0 });

        // Aba 2: Confrontantes
        if (analiseCompleta.confrontantes && analiseCompleta.confrontantes.length > 0) {
            const confSheet = workbook.addWorksheet('Confrontantes');
            confSheet.columns = [
                { header: 'ID', key: 'id', width: 10 },
                { header: 'Nome', key: 'nome', width: 30 },
                { header: 'Matrícula', key: 'matricula', width: 20 },
                { header: 'Distância (m)', key: 'distancia', width: 15 }
            ];

            analiseCompleta.confrontantes.forEach(c => {
                confSheet.addRow({
                    id: c.id,
                    nome: c.nome_propriedade,
                    matricula: c.matricula,
                    distancia: c.distancia ? parseFloat(c.distancia).toFixed(2) : 'N/A'
                });
            });
        }

        // Aba 3: Sobreposições
        if (analiseCompleta.sobreposicoes && analiseCompleta.sobreposicoes.length > 0) {
            const sobSheet = workbook.addWorksheet('Sobreposições');
            sobSheet.columns = [
                { header: 'ID', key: 'id', width: 10 },
                { header: 'Nome', key: 'nome', width: 30 },
                { header: 'Área Sobreposição (m²)', key: 'area', width: 22 },
                { header: '% Sobreposição', key: 'percentual', width: 18 }
            ];

            analiseCompleta.sobreposicoes.forEach(s => {
                sobSheet.addRow({
                    id: s.id,
                    nome: s.nome_propriedade,
                    area: s.area_sobreposicao ? parseFloat(s.area_sobreposicao).toFixed(2) : 'N/A',
                    percentual: s.percentual_sobreposicao ? parseFloat(s.percentual_sobreposicao).toFixed(2) + '%' : 'N/A'
                });
            });
        }

        const filename = `analise_completa_${propriedadeId}_${Date.now()}.xlsx`;
        const filepath = path.join(this.exportsDir, filename);
        await workbook.xlsx.writeFile(filepath);

        return filepath;
    }
}

module.exports = DataExporter;
