import React, { PropsWithChildren } from "react";
import { View, ViewProps } from "react-native";

export default function Box({ style, children, ...rest }: PropsWithChildren<ViewProps>) {
  return (
    <View style={[{ padding: 16, borderRadius: 16, backgroundColor: "#151923" }, style]} {...rest}>
      {children}
    </View>
  );
}
