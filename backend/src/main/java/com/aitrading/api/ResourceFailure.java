package com.aitrading.api;

/** Fixed public errors; never put user content or identifiers into exception messages. */
public final class ResourceFailure extends RuntimeException {
    private final int status;
    private ResourceFailure(int status) { super("Resource request rejected"); this.status = status; }
    public int status() { return status; }
    public static ResourceFailure missing() { return new ResourceFailure(404); }
    public static ResourceFailure conflict() { return new ResourceFailure(409); }
}
