const fs = require('fs') as { readFileSync(path: string, encoding: string): string };
const path = require('path') as { resolve(...parts: string[]): string };
import ts from 'typescript';

const pages = ['HealthReportMain/HealthReportDashboard','HealthReportMain/HealthReportMain',
  'HealthReportBarGraph/HealthReportBarGraphComponent','HealthReportHistoryGraph/HealthReportHistoryGraphComponent',
  'Login/InputTelHPComponent', 'ViewMoreMain/ViewMoreMain', 'InBodyTestMain/InBodyTestProfile',
  'SetupInBodyDataManage/InBodyDataManage', 'HealthReportBarGraph/inbodyDataSelect'];

describe('Refactored native page boundaries', () => {
  it.each(pages)('%s implements every active WXML event without legacy requests or unchecked code', page => {
    const base = path.resolve('miniprogram/pages',page);
    const code = fs.readFileSync(base+'.ts','utf8');
    const wxml = fs.readFileSync(base+'.wxml','utf8').replace(/<!--[\s\S]*?-->/g,'');
    const source = ts.createSourceFile(base+'.ts',code,ts.ScriptTarget.Latest,true);
    const names = new Set<string>();
    function visit(node: ts.Node): void {
      if (ts.isMethodDeclaration(node) || ts.isPropertyAssignment(node)) names.add(node.name.getText(source).replace(/["']/g,''));
      ts.forEachChild(node,visit);
    }
    visit(source);
    const events = Array.from(wxml.matchAll(/(?:bind[\w:]+|catch[\w:]+)\s*=\s*["']([^"']+)["']/g),match=>match[1]);
    expect([...new Set(events)].filter(name=>!names.has(name))).toEqual([]);
    expect(code).not.toMatch(/@ts-nocheck|\brequire\s*\(|wx\.request\s*\(/);
  });
});
