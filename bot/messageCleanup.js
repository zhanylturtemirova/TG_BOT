async function deleteMessages(ctx, messageIds, logger) {
    for (const messageId of messageIds) {
        try {
            await ctx.api.deleteMessage(ctx.chat.id, messageId);
        } catch (error) {
            // Deleted messages and missing permissions must not turn a successful upload into a failure.
            logger.warn('Unable to delete temporary message', error.message);
        }
    }
}

module.exports = { deleteMessages };
