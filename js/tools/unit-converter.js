/* Unit Converter — one value in, every unit of that family out. */
(() => {
  "use strict";
  const { el, $ } = DP;
  const app = $("#app"), side = $("#side-extra");

  const CATS = {
    "Length": { units: { "Millimetre (mm)": 0.001, "Centimetre (cm)": 0.01, "Metre (m)": 1, "Kilometre (km)": 1000, "Inch (in)": 0.0254, "Foot (ft)": 0.3048, "Yard (yd)": 0.9144, "Mile (mi)": 1609.344, "Nautical mile": 1852 } },
    "Mass": { units: { "Milligram (mg)": 1e-6, "Gram (g)": 0.001, "Kilogram (kg)": 1, "Tonne (t)": 1000, "Ounce (oz)": 0.028349523125, "Pound (lb)": 0.45359237, "Stone (st)": 6.35029318 } },
    "Area": { units: { "Square millimetre": 1e-6, "Square centimetre": 1e-4, "Square metre": 1, "Hectare": 10000, "Square kilometre": 1e6, "Square inch": 0.00064516, "Square foot": 0.09290304, "Square yard": 0.83612736, "Acre": 4046.8564224, "Square mile": 2589988.110336 } },
    "Volume": { units: { "Millilitre (ml)": 0.001, "Litre (l)": 1, "Cubic metre": 1000, "Teaspoon (US)": 0.00492892159375, "Tablespoon (US)": 0.01478676478125, "Cup (US)": 0.2365882365, "Pint (US)": 0.473176473, "Quart (US)": 0.946352946, "Gallon (US)": 3.785411784, "Gallon (UK)": 4.54609 } },
    "Speed": { units: { "Metre/second": 1, "Kilometre/hour": 0.2777777778, "Mile/hour": 0.44704, "Knot": 0.5144444444, "Foot/second": 0.3048 } },
    "Time": { units: { "Millisecond": 0.001, "Second": 1, "Minute": 60, "Hour": 3600, "Day": 86400, "Week": 604800, "Month (30d)": 2592000, "Year (365.25d)": 31557600 } },
    "Data": { units: { "Byte": 1, "Kilobyte (1000)": 1e3, "Megabyte (1000)": 1e6, "Gigabyte (1000)": 1e9, "Terabyte (1000)": 1e12, "Kibibyte (1024)": 1024, "Mebibyte (1024)": 1048576, "Gibibyte (1024)": 1073741824, "Tebibyte (1024)": 1099511627776 } },
    "Pressure": { units: { "Pascal (Pa)": 1, "Kilopascal (kPa)": 1000, "Bar": 1e5, "PSI": 6894.757293168, "Atmosphere": 101325, "mmHg (Torr)": 133.3223684211 } },
    "Energy": { units: { "Joule (J)": 1, "Kilojoule (kJ)": 1000, "Calorie (cal)": 4.184, "Kilocalorie (kcal)": 4184, "Watt-hour (Wh)": 3600, "Kilowatt-hour (kWh)": 3.6e6, "BTU": 1055.05585262 } }
  };
  const TEMPS = ["Celsius (°C)", "Fahrenheit (°F)", "Kelvin (K)"];
  const toC = (v, u) => u === 0 ? v : u === 1 ? (v - 32) * 5 / 9 : v - 273.15;
  const fromC = (v, u) => u === 0 ? v : u === 1 ? v * 9 / 5 + 32 : v + 273.15;

  const panel = el("div", { class: "panel" }, el("span", { class: "label", text: "The value" }));
  side.append(panel);
  const catSel = el("select", { class: "select" }, Object.keys(CATS).map(k => el("option", { value: k, text: k })), el("option", { value: "Temperature", text: "Temperature" }));
  const unitSel = el("select", { class: "select", style: "margin-top:8px" });
  const numIn = el("input", { class: "input", type: "number", value: "1", step: "any", style: "margin-top:8px" });
  panel.append(el("div", { class: "field" }, el("span", { class: "label", text: "Family" }), catSel));
  panel.append(el("div", { class: "field", style: "margin-top:8px" }, el("span", { class: "label", text: "You have" }), numIn, unitSel));
  const note = el("div", { class: "panel" }, el("span", { class: "label", text: "Good to know" }),
    el("p", { style: "margin:0;font-size:13px;color:var(--muted);line-height:1.55", text: "One value, the whole family in one table — no fiddly \"from/to\" dance. Data comes in both flavours: the 1000-based units (what drive makers print) and the 1024-based ones (what your computer shows)." }));
  side.append(note);

  const out = el("div", { style: "margin-top:18px" });
  app.append(out);

  function fmtNum(x) {
    if (!isFinite(x)) return "—";
    const a = Math.abs(x);
    if (a !== 0 && (a >= 1e15 || a < 1e-6)) return x.toExponential(6).replace(/\.?0+e/, "e+").replace("e+", "e");
    let s = String(parseFloat(x.toPrecision(10)));
    return s;
  }
  function fillUnits() {
    const cat = catSel.value;
    unitSel.textContent = "";
    const names = cat === "Temperature" ? TEMPS : Object.keys(CATS[cat].units);
    for (const n of names) unitSel.append(el("option", { text: n }));
  }
  function render() {
    const cat = catSel.value;
    const v = parseFloat(numIn.value);
    out.textContent = "";
    if (!isFinite(v)) { out.append(el("div", { class: "empty", text: "Type a number to convert." })); return; }
    const ui = unitSel.selectedIndex;
    const rows = [];
    if (cat === "Temperature") {
      const c = toC(v, ui);
      rows.push(["Celsius (°C)", fromC(c, 0)], ["Fahrenheit (°F)", fromC(c, 1)], ["Kelvin (K)", fromC(c, 2)]);
    } else {
      const units = CATS[cat].units;
      const names = Object.keys(units);
      const fromFactor = units[names[ui]];
      const baseV = v * fromFactor;
      for (const n of names) rows.push([n, baseV / units[n]]);
    }
    const head = el("div", { class: "result-head" },
      el("h3", { text: fmtNum(v) + " in " + (cat === "Temperature" ? TEMPS[ui] : Object.keys(CATS[cat].units)[ui]) }),
      el("span", { class: "label", text: cat.toLowerCase() + ", converted" }));
    out.append(head);
    const list = el("div", { class: "results", style: "margin-top:4px" });
    for (const [name, val] of rows) {
      const txt = fmtNum(val);
      list.append(el("div", { class: "rcard" },
        el("div", { class: "rcard__body" },
          el("div", { class: "label", text: name }),
          el("div", { class: "mono", style: "font-size:15px;margin-top:3px;word-break:break-all", text: txt })),
        el("div", { class: "rcard__actions" },
          el("button", { class: "btn btn--sm", type: "button", onclick: () => DP.copyText(txt) }, "Copy"))));
    }
    out.append(list);
  }
  catSel.addEventListener("change", () => { fillUnits(); render(); });
  unitSel.addEventListener("change", render);
  numIn.addEventListener("input", render);
  fillUnits();
  render();
})();
