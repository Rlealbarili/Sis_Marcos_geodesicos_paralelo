const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');
const path = require('path');

/**
 * Gerador de Relatórios para o Sistema de Marcos Geodésicos
 * Suporta PDF, Excel e CSV
 */
class ReportGenerator {
  constructor() {
    this.reportsDir = path.join(__dirname, '../reports');
    this.ensureReportsDirectory();
  }

  ensureReportsDirectory() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  /**
   * Gera relatório de propriedades em PDF
   */
  async gerarPDFPropriedades(propriedades, filtros = {}) {
    return new Promise((resolve, reject) => {
      try {
        const filename = `propriedades_${Date.now()}.pdf`;
        const filepath = path.join(this.reportsDir, filename);
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filepath);

        doc.pipe(stream);

        // Cabeçalho
        doc.fontSize(20)
           .text('Relatório de Propriedades', { align: 'center' })
           .moveDown();

        // Informações do relatório
        doc.fontSize(10)
           .text(`Data: ${new Date().toLocaleString('pt-BR')}`)
           .text(`Total de registros: ${propriedades.length}`)
           .moveDown();

        // Filtros aplicados
        if (Object.keys(filtros).length > 0) {
          doc.fontSize(12).text('Filtros aplicados:', { underline: true });
          Object.entries(filtros).forEach(([key, value]) => {
            doc.fontSize(10).text(`${key}: ${value}`);
          });
          doc.moveDown();
        }

        // Lista de propriedades
        doc.fontSize(12).text('Propriedades:', { underline: true }).moveDown(0.5);

        propriedades.forEach((prop, index) => {
          // Verifica se precisa adicionar nova página
          if (doc.y > 700) {
            doc.addPage();
          }

          doc.fontSize(11)
             .text(`${index + 1}. ${prop.nome_propriedade}`, { bold: true });

          doc.fontSize(9)
             .text(`   Matrícula: ${prop.matricula || 'N/A'}`)
             .text(`   Tipo: ${prop.tipo || 'N/A'}`)
             .text(`   Município: ${prop.municipio || 'N/A'}`)
             .text(`   UF: ${prop.uf || 'N/A'}`)
             .text(`   Área: ${prop.area_m2 ? (prop.area_m2 / 10000).toFixed(4) + ' ha' : 'N/A'}`)
             .text(`   Perímetro: ${prop.perimetro_m ? prop.perimetro_m.toFixed(2) + ' m' : 'N/A'}`)
             .moveDown(0.5);
        });

        // Finalizar documento
        doc.end();

        stream.on('finish', () => {
          resolve({
            success: true,
            filename,
            filepath,
            registros: propriedades.length
          });
        });

        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Gera relatório de marcos geodésicos em PDF
   */
  async gerarPDFMarcos(marcos, filtros = {}) {
    return new Promise((resolve, reject) => {
      try {
        const filename = `marcos_geodesicos_${Date.now()}.pdf`;
        const filepath = path.join(this.reportsDir, filename);
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filepath);

        doc.pipe(stream);

        // Cabeçalho
        doc.fontSize(20)
           .text('Relatório de Marcos Geodésicos', { align: 'center' })
           .moveDown();

        doc.fontSize(10)
           .text(`Data: ${new Date().toLocaleString('pt-BR')}`)
           .text(`Total de registros: ${marcos.length}`)
           .moveDown();

        // Filtros
        if (Object.keys(filtros).length > 0) {
          doc.fontSize(12).text('Filtros aplicados:', { underline: true });
          Object.entries(filtros).forEach(([key, value]) => {
            doc.fontSize(10).text(`${key}: ${value}`);
          });
          doc.moveDown();
        }

        // Lista de marcos
        doc.fontSize(12).text('Marcos Geodésicos:', { underline: true }).moveDown(0.5);

        marcos.forEach((marco, index) => {
          if (doc.y > 700) {
            doc.addPage();
          }

          doc.fontSize(11)
             .text(`${index + 1}. ${marco.codigo}`, { bold: true });

          doc.fontSize(9)
             .text(`   Tipo: ${marco.tipo || 'N/A'}`)
             .text(`   Latitude: ${marco.latitude || 'N/A'}`)
             .text(`   Longitude: ${marco.longitude || 'N/A'}`)
             .text(`   Altitude: ${marco.altitude ? marco.altitude + ' m' : 'N/A'}`)
             .text(`   Município: ${marco.municipio || 'N/A'}`)
             .text(`   Estado: ${marco.estado || 'N/A'}`)
             .text(`   Status: ${marco.status || 'N/A'}`)
             .moveDown(0.5);
        });

        // Finalizar documento
        doc.end();

        stream.on('finish', () => {
          resolve({
            success: true,
            filename,
            filepath,
            registros: marcos.length
          });
        });

        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Gera relatório em Excel
   */
  async gerarExcelPropriedades(propriedades, filtros = {}) {
    try {
      const filename = `propriedades_${Date.now()}.xlsx`;
      const filepath = path.join(this.reportsDir, filename);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Propriedades');

      // Informações do relatório
      worksheet.mergeCells('A1:H1');
      worksheet.getCell('A1').value = 'Relatório de Propriedades';
      worksheet.getCell('A1').font = { size: 16, bold: true };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };

      worksheet.mergeCells('A2:H2');
      worksheet.getCell('A2').value = `Gerado em: ${new Date().toLocaleString('pt-BR')}`;
      worksheet.getCell('A2').alignment = { horizontal: 'center' };

      // Cabeçalhos
      const headers = ['ID', 'Nome', 'Matrícula', 'Tipo', 'Município', 'UF', 'Área (ha)', 'Perímetro (m)'];
      worksheet.getRow(4).values = headers;
      worksheet.getRow(4).font = { bold: true };
      worksheet.getRow(4).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      };

      // Dados
      propriedades.forEach((prop, index) => {
        worksheet.getRow(5 + index).values = [
          prop.id,
          prop.nome_propriedade,
          prop.matricula,
          prop.tipo,
          prop.municipio,
          prop.uf,
          prop.area_m2 ? (prop.area_m2 / 10000).toFixed(4) : '',
          prop.perimetro_m ? prop.perimetro_m.toFixed(2) : ''
        ];
      });

      // Ajustar largura das colunas
      worksheet.columns.forEach(column => {
        column.width = 15;
      });
      worksheet.getColumn(2).width = 30; // Nome da propriedade

      await workbook.xlsx.writeFile(filepath);

      return {
        success: true,
        filename,
        filepath,
        registros: propriedades.length
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gera relatório em Excel de marcos geodésicos
   */
  async gerarExcelMarcos(marcos, filtros = {}) {
    try {
      const filename = `marcos_geodesicos_${Date.now()}.xlsx`;
      const filepath = path.join(this.reportsDir, filename);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Marcos Geodésicos');

      // Informações do relatório
      worksheet.mergeCells('A1:H1');
      worksheet.getCell('A1').value = 'Relatório de Marcos Geodésicos';
      worksheet.getCell('A1').font = { size: 16, bold: true };
      worksheet.getCell('A1').alignment = { horizontal: 'center' };

      worksheet.mergeCells('A2:H2');
      worksheet.getCell('A2').value = `Gerado em: ${new Date().toLocaleString('pt-BR')}`;
      worksheet.getCell('A2').alignment = { horizontal: 'center' };

      // Cabeçalhos
      const headers = ['ID', 'Código', 'Tipo', 'Latitude', 'Longitude', 'Altitude', 'Município', 'Estado'];
      worksheet.getRow(4).values = headers;
      worksheet.getRow(4).font = { bold: true };
      worksheet.getRow(4).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      };

      // Dados
      marcos.forEach((marco, index) => {
        worksheet.getRow(5 + index).values = [
          marco.id,
          marco.codigo,
          marco.tipo,
          marco.latitude,
          marco.longitude,
          marco.altitude,
          marco.municipio,
          marco.estado
        ];
      });

      // Ajustar largura das colunas
      worksheet.columns.forEach(column => {
        column.width = 15;
      });

      await workbook.xlsx.writeFile(filepath);

      return {
        success: true,
        filename,
        filepath,
        registros: marcos.length
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gera relatório em CSV
   */
  async gerarCSVPropriedades(propriedades) {
    try {
      const filename = `propriedades_${Date.now()}.csv`;
      const filepath = path.join(this.reportsDir, filename);

      const csvWriter = createObjectCsvWriter({
        path: filepath,
        header: [
          { id: 'id', title: 'ID' },
          { id: 'nome_propriedade', title: 'Nome' },
          { id: 'matricula', title: 'Matrícula' },
          { id: 'tipo', title: 'Tipo' },
          { id: 'municipio', title: 'Município' },
          { id: 'uf', title: 'UF' },
          { id: 'area_ha', title: 'Área (ha)' },
          { id: 'perimetro_m', title: 'Perímetro (m)' }
        ]
      });

      const records = propriedades.map(prop => ({
        ...prop,
        area_ha: prop.area_m2 ? (prop.area_m2 / 10000).toFixed(4) : '',
        perimetro_m: prop.perimetro_m ? prop.perimetro_m.toFixed(2) : ''
      }));

      await csvWriter.writeRecords(records);

      return {
        success: true,
        filename,
        filepath,
        registros: propriedades.length
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gera relatório em CSV de marcos geodésicos
   */
  async gerarCSVMarcos(marcos) {
    try {
      const filename = `marcos_geodesicos_${Date.now()}.csv`;
      const filepath = path.join(this.reportsDir, filename);

      const csvWriter = createObjectCsvWriter({
        path: filepath,
        header: [
          { id: 'id', title: 'ID' },
          { id: 'codigo', title: 'Código' },
          { id: 'tipo', title: 'Tipo' },
          { id: 'latitude', title: 'Latitude' },
          { id: 'longitude', title: 'Longitude' },
          { id: 'altitude', title: 'Altitude' },
          { id: 'municipio', title: 'Município' },
          { id: 'estado', title: 'Estado' },
          { id: 'status', title: 'Status' }
        ]
      });

      await csvWriter.writeRecords(marcos);

      return {
        success: true,
        filename,
        filepath,
        registros: marcos.length
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gera relatório de análise completa em PDF
   */
  async gerarRelatorioAnaliseCompleta(propriedadeId, analiseCompleta) {
    return new Promise((resolve, reject) => {
      try {
        const filename = `analise_completa_${propriedadeId}_${Date.now()}.pdf`;
        const filepath = path.join(this.reportsDir, filename);
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filepath);

        doc.pipe(stream);

        // Cabeçalho
        doc.fontSize(20)
           .text('Relatório de Análise Completa', { align: 'center' })
           .moveDown();

        doc.fontSize(12)
           .text(`Propriedade ID: ${propriedadeId}`)
           .text(`Data: ${new Date().toLocaleString('pt-BR')}`)
           .moveDown();

        // Informações da Propriedade
        if (analiseCompleta.propriedade) {
          const prop = analiseCompleta.propriedade;
          doc.fontSize(14).text('Informações da Propriedade:', { underline: true }).moveDown(0.5);
          doc.fontSize(10)
             .text(`Nome: ${prop.nome_propriedade || 'N/A'}`)
             .text(`Matrícula: ${prop.matricula || 'N/A'}`)
             .text(`Município: ${prop.municipio || 'N/A'}`)
             .text(`Área: ${prop.area_m2 ? (prop.area_m2 / 10000).toFixed(4) + ' ha' : 'N/A'}`)
             .moveDown();
        }

        // Score de Qualidade
        if (analiseCompleta.score) {
          const score = analiseCompleta.score;
          doc.fontSize(14).text('Score de Qualidade:', { underline: true }).moveDown(0.5);
          doc.fontSize(10)
             .text(`Score Total: ${score.score_total || 'N/A'}/100`)
             .text(`Geometria: ${score.score_geometria || 'N/A'}`)
             .text(`Documentação: ${score.score_documentacao || 'N/A'}`)
             .text(`Status: ${score.status || 'N/A'}`)
             .moveDown();
        }

        // Confrontantes
        if (analiseCompleta.confrontantes && analiseCompleta.confrontantes.length > 0) {
          doc.fontSize(14).text(`Confrontantes (${analiseCompleta.confrontantes.length}):`, { underline: true }).moveDown(0.5);
          analiseCompleta.confrontantes.slice(0, 5).forEach((conf, idx) => {
            doc.fontSize(9)
               .text(`${idx + 1}. ${conf.nome_propriedade} - Distância: ${conf.distancia ? conf.distancia.toFixed(2) : 'N/A'}m`);
          });
          if (analiseCompleta.confrontantes.length > 5) {
            doc.text(`... e mais ${analiseCompleta.confrontantes.length - 5} confrontantes`);
          }
          doc.moveDown();
        }

        // Sobreposições
        if (analiseCompleta.sobreposicoes && analiseCompleta.sobreposicoes.length > 0) {
          doc.fontSize(14).text(`Sobreposições (${analiseCompleta.sobreposicoes.length}):`, { underline: true }).moveDown(0.5);
          analiseCompleta.sobreposicoes.forEach((sob, idx) => {
            doc.fontSize(9)
               .text(`${idx + 1}. ${sob.nome_propriedade} - ${sob.percentual_sobreposicao ? sob.percentual_sobreposicao.toFixed(2) : 'N/A'}%`);
          });
          doc.moveDown();
        }

        doc.end();

        stream.on('finish', () => resolve(filepath));
        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Gera relatório de confrontantes em PDF
   */
  async gerarRelatorioConfrontantes(propriedadeId, confrontantes) {
    return new Promise((resolve, reject) => {
      try {
        const filename = `confrontantes_${propriedadeId}_${Date.now()}.pdf`;
        const filepath = path.join(this.reportsDir, filename);
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filepath);

        doc.pipe(stream);

        // Cabeçalho
        doc.fontSize(20)
           .text('Relatório de Confrontantes', { align: 'center' })
           .moveDown();

        doc.fontSize(12)
           .text(`Propriedade ID: ${propriedadeId}`)
           .text(`Data: ${new Date().toLocaleString('pt-BR')}`)
           .text(`Total de confrontantes: ${confrontantes.length}`)
           .moveDown();

        // Lista de confrontantes
        doc.fontSize(14).text('Propriedades Confrontantes:', { underline: true }).moveDown(0.5);

        confrontantes.forEach((conf, index) => {
          if (doc.y > 700) {
            doc.addPage();
          }

          doc.fontSize(11).text(`${index + 1}. ${conf.nome_propriedade}`, { bold: true });
          doc.fontSize(9)
             .text(`   Matrícula: ${conf.matricula || 'N/A'}`)
             .text(`   Município: ${conf.municipio || 'N/A'}`)
             .text(`   Área: ${conf.area_m2 ? (conf.area_m2 / 10000).toFixed(4) + ' ha' : 'N/A'}`)
             .text(`   Distância: ${conf.distancia ? conf.distancia.toFixed(2) + ' m' : 'N/A'}`)
             .moveDown(0.5);
        });

        doc.end();

        stream.on('finish', () => resolve(filepath));
        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Gera relatório de viabilidade em PDF
   */
  async gerarRelatorioViabilidade(propriedadeId, viabilidade) {
    return new Promise((resolve, reject) => {
      try {
        const filename = `viabilidade_${propriedadeId}_${Date.now()}.pdf`;
        const filepath = path.join(this.reportsDir, filename);
        const doc = new PDFDocument({ margin: 50 });
        const stream = fs.createWriteStream(filepath);

        doc.pipe(stream);

        // Cabeçalho
        doc.fontSize(20)
           .text('Relatório de Viabilidade', { align: 'center' })
           .moveDown();

        doc.fontSize(12)
           .text(`Propriedade ID: ${propriedadeId}`)
           .text(`Data: ${new Date().toLocaleString('pt-BR')}`)
           .moveDown();

        // Parecer
        const parecerColor = viabilidade.parecer === 'VIÁVEL' ? 'green' :
                            viabilidade.parecer === 'VIÁVEL COM RESSALVAS' ? 'orange' : 'red';
        doc.fontSize(16)
           .fillColor(parecerColor)
           .text(`PARECER: ${viabilidade.parecer}`, { align: 'center' })
           .fillColor('black')
           .moveDown();

        // Score
        if (viabilidade.score) {
          doc.fontSize(14).text('Score de Qualidade:', { underline: true }).moveDown(0.5);
          doc.fontSize(10)
             .text(`Score Total: ${viabilidade.score.score_total || 'N/A'}/100`)
             .text(`Status: ${viabilidade.score.status || 'N/A'}`)
             .moveDown();
        }

        // Análise de Riscos
        doc.fontSize(14).text('Análise de Riscos:', { underline: true }).moveDown(0.5);

        doc.fontSize(10)
           .text(`Sobreposições identificadas: ${viabilidade.sobreposicoes ? viabilidade.sobreposicoes.length : 0}`)
           .text(`Confrontantes: ${viabilidade.confrontantes ? viabilidade.confrontantes.length : 0}`)
           .moveDown();

        // Recomendações
        doc.fontSize(14).text('Recomendações:', { underline: true }).moveDown(0.5);

        if (viabilidade.parecer === 'VIÁVEL') {
          doc.fontSize(10).text('- Propriedade apta para registro sem restrições');
          doc.text('- Documentação e geometria em conformidade');
        } else if (viabilidade.parecer === 'VIÁVEL COM RESSALVAS') {
          doc.fontSize(10).text('- Verificar e resolver sobreposições identificadas');
          doc.text('- Atualizar documentação se necessário');
          doc.text('- Validar limites com confrontantes');
        } else {
          doc.fontSize(10).text('- Não recomendado prosseguir com registro');
          doc.text('- Resolver problemas críticos identificados');
          doc.text('- Revisar completamente a documentação e geometria');
        }

        doc.end();

        stream.on('finish', () => resolve(filepath));
        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = new ReportGenerator();
