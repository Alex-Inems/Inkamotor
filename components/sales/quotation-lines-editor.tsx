"use client";

import { useEffect, useRef, useState } from "react";
import { btnSecondary, inputUnderlineClass } from "@/components/modal";
import { ProductSearchInput } from "@/components/sales/product-search-input";
import type { Product, SaleLine } from "@/lib/demo-data";
import { SalesAmount } from "@/components/sales/sales-amount";
import { lineTotal } from "@/lib/quotation-form-data";
import { orderQuotationBodyLines } from "@/lib/quote-templates";
import { useLocale } from "@/lib/i18n";

type LineBlock = SaleLine[];

function splitBoilerplateBlocks(lines: SaleLine[]) {
  const products = lines.filter((line) => line.displayType === "product");
  const rest = lines.filter((line) => line.displayType !== "product");
  const blocks: LineBlock[] = [];
  let current: LineBlock = [];

  for (const line of rest) {
    if (line.displayType === "section" && current.length > 0) {
      blocks.push(current);
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current);

  return { blocks, products };
}

function blocksToLines(blocks: LineBlock[], products: SaleLine[]) {
  return [...blocks.flat(), ...products];
}

function moveBlock(blocks: LineBlock[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= blocks.length || to >= blocks.length) {
    return blocks;
  }
  const next = [...blocks];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

function AutoTextarea({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 80)}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={3}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    />
  );
}

export function QuotationLinesEditor({
  lines,
  products,
  onChange,
  onOpenCatalogue,
  showCatalogue = true,
  termsHtml,
}: {
  lines: SaleLine[];
  products: Product[];
  onChange: (lines: SaleLine[]) => void;
  onOpenCatalogue?: () => void;
  showCatalogue?: boolean;
  termsHtml?: string;
}) {
  const { t, locale } = useLocale();
  const [draggingBlock, setDraggingBlock] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  const displayLines = orderQuotationBodyLines(lines, {
    ensureProduct: showCatalogue,
  });
  const { blocks, products: productLines } = splitBoilerplateBlocks(displayLines);

  const catalogProducts = products
    .filter((product) => product.active && product.saleOk)
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  function commit(nextBlocks: LineBlock[], nextProducts: SaleLine[]) {
    onChange(
      orderQuotationBodyLines(blocksToLines(nextBlocks, nextProducts), {
        ensureProduct: showCatalogue,
      }),
    );
  }

  function updateBlockLine(
    blockIndex: number,
    lineIndex: number,
    patch: Partial<SaleLine>,
  ) {
    const parsed = splitBoilerplateBlocks(displayLines);
    const nextBlocks = parsed.blocks.map((block, bi) =>
      bi === blockIndex
        ? block.map((line, li) => (li === lineIndex ? { ...line, ...patch } : line))
        : block,
    );
    commit(nextBlocks, parsed.products);
  }

  function removeBlockLine(blockIndex: number, lineIndex: number) {
    const parsed = splitBoilerplateBlocks(displayLines);
    const block = parsed.blocks[blockIndex];
    if (!block) return;
    const nextBlock = block.filter((_, li) => li !== lineIndex);
    const nextBlocks =
      nextBlock.length === 0
        ? parsed.blocks.filter((_, bi) => bi !== blockIndex)
        : parsed.blocks.map((b, bi) => (bi === blockIndex ? nextBlock : b));
    commit(nextBlocks, parsed.products);
  }

  function updateProductLine(productIndex: number, patch: Partial<SaleLine>) {
    const parsed = splitBoilerplateBlocks(displayLines);
    const nextProducts = parsed.products.map((line, i) =>
      i === productIndex ? { ...line, ...patch } : line,
    );
    commit(parsed.blocks, nextProducts);
  }

  function removeProductLine(productIndex: number) {
    const parsed = splitBoilerplateBlocks(displayLines);
    const nextProducts = parsed.products.filter((_, i) => i !== productIndex);
    commit(parsed.blocks, nextProducts);
  }

  function addLine(type: SaleLine["displayType"]) {
    const parsed = splitBoilerplateBlocks(displayLines);
    const newLine: SaleLine = {
      description: "",
      displayType: type,
      qty: type === "product" ? 1 : 0,
      unitPrice: 0,
    };

    if (type === "product") {
      commit(parsed.blocks, [...parsed.products, newLine]);
      return;
    }

    if (type === "section") {
      commit([...parsed.blocks, [newLine]], parsed.products);
      return;
    }

    const lastBlock = parsed.blocks[parsed.blocks.length - 1];
    if (lastBlock) {
      const nextBlocks = parsed.blocks.map((block, i) =>
        i === parsed.blocks.length - 1 ? [...block, newLine] : block,
      );
      commit(nextBlocks, parsed.products);
    } else {
      commit([[newLine]], parsed.products);
    }
  }

  function onProductPick(
    productIndex: number,
    product: { name: string; listPrice: number },
  ) {
    updateProductLine(productIndex, {
      description: product.name,
      unitPrice: product.listPrice,
    });
  }

  function onBlockDrop(targetIndex: number) {
    if (draggingBlock == null || draggingBlock === targetIndex) return;
    const parsed = splitBoilerplateBlocks(displayLines);
    commit(moveBlock(parsed.blocks, draggingBlock, targetIndex), parsed.products);
    setDraggingBlock(null);
    setDropTarget(null);
  }

  return (
    <div className="quotation-lines-editor max-w-full overflow-x-hidden">
      <div className="space-y-2">
        {blocks.map((block, blockIndex) => (
          <div
            key={`block-${blockIndex}-${block[0]?.displayType}-${block[0]?.description.slice(0, 12)}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDropTarget(blockIndex);
            }}
            onDragLeave={() => {
              if (dropTarget === blockIndex) setDropTarget(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              onBlockDrop(blockIndex);
            }}
            className={`rounded border border-line bg-ash/20 transition-colors ${
              draggingBlock === blockIndex ? "opacity-50" : ""
            } ${dropTarget === blockIndex && draggingBlock !== blockIndex ? "border-accent ring-1 ring-accent/40" : ""}`}
          >
            <div className="flex items-start gap-1 px-2 py-2 sm:gap-2">
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  setDraggingBlock(blockIndex);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  setDraggingBlock(null);
                  setDropTarget(null);
                }}
                className="mt-2 shrink-0 cursor-grab px-1 text-mute hover:text-ink active:cursor-grabbing"
                aria-label={t("pages.sales.dragSection")}
                title={t("pages.sales.dragSection")}
              >
                <span className="text-base leading-none" aria-hidden>
                  ⠿
                </span>
              </button>

              <div className="min-w-0 flex-1 space-y-1">
                {block.map((line, lineIndex) =>
                  line.displayType === "section" ? (
                    <div key={`section-${lineIndex}`} className="flex items-start gap-2">
                      <input
                        className={`${inputUnderlineClass} min-w-0 flex-1 font-semibold`}
                        value={line.description}
                        onChange={(e) =>
                          updateBlockLine(blockIndex, lineIndex, {
                            description: e.target.value,
                          })
                        }
                        placeholder={t("pages.sales.sectionTitle")}
                      />
                      <button
                        type="button"
                        className="shrink-0 px-1 text-xs text-mute hover:text-ink"
                        onClick={() => removeBlockLine(blockIndex, lineIndex)}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div key={`note-${lineIndex}`} className="flex items-start gap-2">
                      <AutoTextarea
                        value={line.description}
                        onChange={(text) =>
                          updateBlockLine(blockIndex, lineIndex, { description: text })
                        }
                        placeholder={t("pages.sales.notePlaceholder")}
                        className={`${inputUnderlineClass} min-h-20 w-full min-w-0 resize-none overflow-hidden wrap-break-word text-sm leading-relaxed whitespace-pre-wrap`}
                      />
                      <button
                        type="button"
                        className="shrink-0 px-1 text-xs text-mute hover:text-ink"
                        onClick={() => removeBlockLine(blockIndex, lineIndex)}
                      >
                        ×
                      </button>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {productLines.length > 0 ? (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">
            {t("pages.sales.lineProduct")}
          </p>
          {productLines.map((line, productIndex) => (
            <div
              key={`product-${productIndex}`}
              className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_4.5rem_5.5rem_5.5rem_auto] sm:items-center sm:gap-3"
            >
              <ProductSearchInput
                className={`${inputUnderlineClass} min-w-0`}
                products={catalogProducts}
                value={line.description}
                placeholder={t("pages.sales.pickProduct")}
                onValueChange={(text) =>
                  updateProductLine(productIndex, { description: text })
                }
                onProductSelect={(product) => onProductPick(productIndex, product)}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                aria-label={t("pages.sales.lineQty")}
                className={`${inputUnderlineClass} text-right`}
                value={line.qty}
                onChange={(e) =>
                  updateProductLine(productIndex, { qty: Number(e.target.value) || 0 })
                }
              />
              <input
                type="number"
                min="0"
                step="0.01"
                aria-label={t("pages.sales.lineUnitPrice")}
                className={`${inputUnderlineClass} text-right`}
                value={line.unitPrice}
                onChange={(e) =>
                  updateProductLine(productIndex, {
                    unitPrice: Number(e.target.value) || 0,
                  })
                }
              />
              <SalesAmount
                amount={lineTotal(line)}
                locale={locale}
                className="block text-right"
              />
              <button
                type="button"
                className="justify-self-end text-xs text-mute hover:text-ink sm:justify-self-center"
                onClick={() => removeProductLine(productIndex)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {termsHtml?.trim() ? (
        <section className="mt-4 border-t border-line pt-4">
          <div
            className="quote-terms text-xs leading-relaxed text-mute [&_li]:ml-4 [&_p]:mb-2 [&_strong]:text-ink"
            dangerouslySetInnerHTML={{ __html: termsHtml }}
          />
        </section>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {showCatalogue && onOpenCatalogue ? (
          <button type="button" className={btnSecondary} onClick={onOpenCatalogue}>
            {t("pages.sales.addProduct")}
          </button>
        ) : (
          <button type="button" className={btnSecondary} onClick={() => addLine("product")}>
            {t("pages.sales.addProduct")}
          </button>
        )}
        <button type="button" className={btnSecondary} onClick={() => addLine("section")}>
          {t("pages.sales.addSection")}
        </button>
        <button type="button" className={btnSecondary} onClick={() => addLine("note")}>
          {t("pages.sales.addNote")}
        </button>
      </div>
    </div>
  );
}
