export async function runWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  worker: (item: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
  if (concurrency < 1) {
    throw new Error("Concurrency must be at least 1.");
  }

  const output: TOutput[] = new Array(items.length);
  let cursor = 0;

  async function next() {
    const index = cursor;
    cursor += 1;
    if (index >= items.length) {
      return;
    }

    output[index] = await worker(items[index], index);
    await next();
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => next(),
  );

  await Promise.all(workers);
  return output;
}
