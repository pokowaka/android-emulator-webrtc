import React from "react";
import WsJsepProtocol from "../net/ws_jsep_protocol_driver";
export interface MouseKeyHandlerProps {
    /** The REST endpoint to retrieve status. */
    statusUrl: string;
    /** Jsep protocol driver, used to send mouse & touch events. */
    jsep: WsJsepProtocol;
    /** The authentication service to use. */
    auth?: any;
    /** The width of the component. */
    width?: number;
    /** The height of the component. */
    height?: number;
    [key: string]: any;
}
export interface MouseKeyHandlerRef {
    scaleCoordinates(xp: number, yp: number): {
        x: number;
        y: number;
        scaleX: number;
        scaleY: number;
    };
    setDeviceWidth: React.Dispatch<React.SetStateAction<number>>;
    setDeviceHeight: React.Dispatch<React.SetStateAction<number>>;
    handlerRef: React.RefObject<HTMLDivElement>;
}
/**
 * A handler that extends a view to send key/mouse events to the emulator.
 * It wraps the inner component in a div, and will use the jsep handler
 * to send key/mouse/touch events over the proper channel.
 *
 * It will translate the mouse events based upon the returned display size of
 * the emulator.
 *
 * You usually want to wrap a EmulatorRtcview, or EmulatorPngView in it.
 */
export default function withMouseKeyHandler<P extends object>(WrappedComponent: React.ComponentType<P>): React.ForwardRefExoticComponent<React.PropsWithoutRef<MouseKeyHandlerProps & P> & React.RefAttributes<MouseKeyHandlerRef>>;
