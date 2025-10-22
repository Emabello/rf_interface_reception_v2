sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("rfinterfacereceptionv2.controller.FirstView", {
      onInit() {
        // Recupero la stringa con la chiave
        var sText = this.getOwnerComponent()
          .getModel("i18n")
          .getResourceBundle()
          .getText("Next");

        // Prendo il bottone per id locale e cambio il testo
        this.byId("_IDGenButton_1").setText(sText);

        // Recupero la stringa con la chiave
        var sText = this.getOwnerComponent()
          .getModel("i18n")
          .getResourceBundle()
          .getText("Back");

        // Prendo il bottone per id locale e cambio il testo
        this.byId("_IDGenButton_2").setText(sText);

        const oRouter = this.getOwnerComponent().getRouter();
        oRouter
          .getRoute("RouteFirstView")
          .attachPatternMatched(this.onRouteMatched, this);
      },
      onRouteMatched: function () {
        const sOrder = sessionStorage.getItem("storeOrder");

        if (sOrder) {
          this.byId("_IDGenInput_1_t").setValue(sOrder);
        }
      },

      onScanSuccessOne: function (oEvent) {
        const oResourceBundle = this.getOwnerComponent()
          .getModel("i18n")
          .getResourceBundle();

        if (oEvent.getParameter("cancelled")) {
          const sText = oResourceBundle.getText("ScanCancelled");
          MessageToast.show(sText, { duration: 1000 });
          return;
        }

        const scannedValue = oEvent.getParameter("text");

        if (scannedValue !== undefined && scannedValue !== null) {
          const customData = oEvent.getSource().getCustomData();

          const inputId = customData
            .find((d) => d.getKey() === "inputId")
            ?.getValue();

          const oView = this.getView();

          if (inputId) {
            const input = oView.byId(inputId);
            if (input) {
              input.setValue(scannedValue);
            }
          }
        } else {
          const sText = oResourceBundle.getText("NoBarcodeDetected");
          MessageToast.show(sText, { duration: 1000 });

          const oInput = this.byId("sampleBarcodeScannerResultTwo");
          if (oInput) {
            oInput.setValue(""); // Pulisce il campo
          }
        }
      },

      onPress: async function () {
        const that = this;

        const oView = this.getView();
        const oModel = oView.getModel();

        const s_Order = oView.byId("_IDGenInput_1_t").getValue();

        if (!s_Order) {
          const sText = this.getOwnerComponent()
            .getModel("i18n")
            .getResourceBundle()
            .getText("PleaseEnterOrder");

          MessageBox.error(sText);
          return;
        }

        const getOrder = (sOrder, storeOrder) => {
          return new Promise((resolve_order) => {
            oModel.callFunction("/getPOEAN", {
              method: "GET",
              urlParameters: {
                PurchaseOrder: sOrder,
              },
              success: function (oData) {
                if (oData.getPOEAN.Message) {
                  MessageBox.error(oData.getPOEAN.Message);
                  resolve_order(false);
                } else {
                  sessionStorage.setItem(storeOrder, sOrder);
                  resolve_order(true);
                }
              },
              error: function () {
                const sText = that
                  .getOwnerComponent()
                  .getModel("i18n")
                  .getResourceBundle()
                  .getText("ErrorDuring");
                MessageBox.error(sText);
                resolve_order(false);
              },
            });
          });
        };

        const [okOrder] = await Promise.all([getOrder(s_Order, "storeOrder")]);

        if (okOrder) {
          setTimeout(() => {
            this.getOwnerComponent().getRouter().navTo("RouteSecondView");
          }, 1000); // wait for 1 second
        }
      },

      onLiveChange: function (oEvent) {
        const sValue = oEvent.getParameter("value");
        sessionStorage.setItem("storeOrder", sValue);
        if (!sValue) {
          sessionStorage.clear();
        }
      },

      onPressReject: function () {
        const oView = this.getView();

        sessionStorage.clear();
        oView.byId("_IDGenInput_1_t").setValue("");
      },

      onNavBack: function () {
        var sOrigin = window.location.origin;
        var sUrl = sOrigin + "/ui?sap-ushell-config=headerless#RFMenu-display";
        window.location.href = sUrl;
      },
    });
});