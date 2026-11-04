import { asciiToSvg } from '../src/utils';

describe('asciiToSvg', () => {
  it('should generate valid monochrome SVG with proper viewBox and background rect', () => {
    const ascii = '@@@@\n####\n++++';
    const svg = asciiToSvg(ascii, undefined, 12, '#000000', '#ffffff');

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox=');
    expect(svg).toContain('<rect width="100%" height="100%" fill="#000000"');
    expect(svg).toContain('font-family=');
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toContain('@@@@');
    expect(svg).toContain('####');
    expect(svg).toContain('++++');
    expect(svg).toContain('</svg>');
  });

  it('should escape XML entities in ASCII characters', () => {
    const ascii = '<&>"\'';
    const svg = asciiToSvg(ascii);

    expect(svg).toContain('&lt;&amp;&gt;&quot;&apos;');
    expect(svg).not.toContain('<&>"\'');
  });

  it('should consolidate consecutive identical colors into single tspan elements', () => {
    const ascii = 'AAABBB';
    const colors = [
      [
        { r: 255, g: 0, b: 0 },
        { r: 255, g: 0, b: 0 },
        { r: 255, g: 0, b: 0 },
        { r: 0, g: 255, b: 0 },
        { r: 0, g: 255, b: 0 },
        { r: 0, g: 255, b: 0 }
      ]
    ];

    const svg = asciiToSvg(ascii, colors);

    // Should contain exactly 2 tspan elements, not 6
    const tspanMatches = svg.match(/<tspan /g);
    expect(tspanMatches?.length).toBe(2);
    expect(svg).toContain('fill="rgb(255,0,0)">AAA</tspan>');
    expect(svg).toContain('fill="rgb(0,255,0)">BBB</tspan>');
  });
});
