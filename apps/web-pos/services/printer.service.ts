export const printerService = {
  async printReceipt(payload: Record<string, unknown>) {
    const config = useRuntimeConfig()
    return await $fetch(`${config.public.printerGatewayUrl}/print`, { method: 'POST', body: payload })
  }
}
