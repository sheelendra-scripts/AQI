#!/usr/bin/env python3
"""Fix unicode characters in generate_report.py for FPDF compatibility."""
import sys

filepath = "scripts/generate_report.py"
with open(filepath, "r") as f:
    content = f.read()

replacements = {
    "\u2014": "-",      # em-dash
    "\u2013": "-",      # en-dash  
    "\u2018": "'",      # left single quote
    "\u2019": "'",      # right single quote
    "\u201c": '"',      # left double quote
    "\u201d": '"',      # right double quote
    "\u2022": "-",      # bullet
    "\u00b5": "u",      # micro sign
    "\u00b0": " deg",   # degree
    "\u2264": "<=",     # less than or equal
    "\u2265": ">=",     # greater than or equal
    "chr(8226)": "chr(45)",  # bullet char code
}

for old, new in replacements.items():
    content = content.replace(old, new)

with open(filepath, "w") as f:
    f.write(content)

print("Fixed unicode characters in", filepath)
