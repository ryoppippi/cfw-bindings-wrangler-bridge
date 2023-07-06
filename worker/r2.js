// @ts-check

/** 
 * @param {any} binding 
 * @returns {binding is R2Bucket}
 */
export const isR2Binding = (binding) => binding.constructor.name === "R2Bucket";

/**
 * @param {R2Bucket} R2
 * @param {Request} req
 */
export const r2Handle = async (R2, req) => {
  const { operation, parameters } = JSON.parse(
    req.headers.get("X-BRIDGE-R2-REQUEST") ?? "{}"
  );

  if (operation === "head") {
    const [key] = parameters;

    const result = await R2.head(key);

    return Response.json(result);
  }

  if (operation === "get") {
    const [key, options] = parameters;

    // Retrieves the `R2ObjectBody` for the given key
    //   containing object metadata and the object body as a `ReadableStream`, if the key exists, 
    // and null if the key does not exist. 
    //
    // In the event that a precondition specified in `options` fails,
    //   `get()` returns an `R2Object` with body undefined.
    // https://developers.cloudflare.com/r2/api/workers/workers-api-reference/#bucket-method-definitions
    const result = await R2.get(key, options);


    if (result === null) {
    return new Response(result, {

    });
    }

    // `R2ObjectBody`
    if ("body" in result) {
    return new Response(result, {

    });
    }

    // `R2Object`
    return new Response(result, {

    });
  }

  if (operation === "put") {
    const [key, , options] = parameters;
    const value = req.body;

    // Need to await here, otherwise already sent error
    const result = await R2.put(key, value, options);

    return Response.json(result);
  }

  if (operation === "list") {
    const [options] = parameters;

    const result = await R2.list(options);

    return Response.json(result);
  }

  if (operation === "delete") {
    const [key] = parameters;

    await R2.delete(key);

    return new Response();
  }

  return new Response(`Unknown operation: ${operation}.`, { status: 404 });
};
