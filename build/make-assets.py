import json, zipfile, os

os.makedirs("test-assets", exist_ok=True)

with open("test-assets/hello.txt", "w", encoding="utf-8") as f:
    f.write("Hello from DigitPDF test suite.\nSecond line with  double  spaces.\n")

with open("test-assets/sample.csv", "w", encoding="utf-8") as f:
    f.write("name,qty,price\nWidget,3,4.50\nGadget,10,2.25\nDoohickey,7,19.99\n")

with open("test-assets/sample.json", "w", encoding="utf-8") as f:
    f.write(json.dumps([{"name": "Widget", "qty": 3, "price": 4.5},
                        {"name": "Gadget", "qty": 10, "price": 2.25}], indent=2))

with open("test-assets/notes.md", "w", encoding="utf-8") as f:
    f.write("# Title\n\nSome **bold** text and a [link](https://digitpdf.io).\n\n- one\n- two\n")

with open("test-assets/page.html", "w", encoding="utf-8") as f:
    f.write('<h1>Old page</h1><p>Some <b>bold</b> and <a href="https://x.test">a link</a>.</p><ul><li>one</li><li>two</li></ul>')

with zipfile.ZipFile("test-assets/sample.zip", "w", zipfile.ZIP_DEFLATED) as z:
    z.write("test-assets/hello.txt", "hello.txt")
    z.write("test-assets/sample.csv", "docs/sample.csv")

print("assets written")
